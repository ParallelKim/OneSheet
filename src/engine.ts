import { getFontBufferSource, registerSoundfonts } from "@strudel/soundfonts";
import {
  evaluate,
  getAudioContext,
  getSuperdoughAudioController,
  hush,
  initAudio,
  initStrudel,
  samples,
} from "@strudel/web";

/** initStrudel 반환 타입이 느슨해서 scheduler만 느슨히 잡는다 */
// deno-lint-ignore no-explicit-any
type Repl = any;

let boot: Promise<Repl> | null = null;
let replRef: Repl | null = null;
/** evaluate 직렬화 — 재생 중 연속 편집 시 레이스 방지 */
let queue: Promise<void> = Promise.resolve();
let lastCode = "";
/**
 * 재생 세대. hush 때마다 증가.
 * 진행 중이던 evaluate가 끝난 뒤 세트가 다르면 즉시 다시 stop.
 */
let epoch = 0;

let dirtGtrLoaded = false;
let fontsWarmed = false;

/**
 * dirt-samples gtr — 단일 WAV만.
 * 다중 WAV면 n(스트럼)이 샘플 인덱스로 겹쳐 깨진다.
 */
const DIRT_GTR = {
  gtr: ["gtr/0001_cleanC.wav"],
} as const;
const DIRT_BASE =
  "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/";

/** gm_electric_guitar_clean:5 → Stratocaster */
const STRUM_FONT = "0270_Stratocaster_sf2_file";
/** gm_piano → FluidR3 (JCLive보다 로드·디코드 부담이 덜한 편) */
const PIANO_FONT = "0000_FluidR3_GM_sf2_file";
/** 오픈 셰이프 음역 — still loading 스킵 방지 */
const WARM_MIDI = [40, 45, 48, 50, 52, 55, 59, 60, 64, 67];

const MASTER_DUCK_SEC = 0.03;
const MASTER_OPEN_SEC = 0.012;

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

/**
 * iOS: Web Audio 기본 세션이 ambient → 무음 스위치에 막힘.
 * playback으로 두면 링거 무음이어도 들림 (Safari AudioSession).
 */
export function preferPlaybackAudioSession(): void {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session && session.type !== "playback") {
      session.type = "playback";
    }
  } catch {
    /* AudioSession 미지원 */
  }
}

/**
 * 제스처 콜스택 안에서 동기 호출.
 * resume + 무음 버퍼 1샘플 — iOS가 출력 경로를 열어 줌.
 */
export function unlockAudioOutput(): void {
  preferPlaybackAudioSession();
  try {
    const ctx = getAudioContext() as AudioContext;
    void ctx.resume();
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch (err) {
    console.warn("unlockAudioOutput failed", err);
  }
}

export function getLastStrudelCode(): string {
  return lastCode;
}

export function getPlaybackEpoch(): number {
  return epoch;
}

export function isEngineReady(): boolean {
  return replRef != null;
}

/**
 * 현재 사이클 위상 0..1 (한 사이클 = 차트 전체 16박).
 * 엔진 미준비·정지 직후면 null.
 */
export function getCyclePhase(): number | null {
  const t = getCycleTime();
  if (t == null) return null;
  return ((t % 1) + 1) % 1;
}

/**
 * 스케줄러 절대 사이클 시각 (cat 체인에서 sheetIndex = floor(t) % N).
 */
export function getCycleTime(): number | null {
  const now = replRef?.scheduler?.now;
  if (typeof now !== "function") return null;
  try {
    const t = now.call(replRef.scheduler) as number;
    if (!Number.isFinite(t)) return null;
    return t;
  } catch {
    return null;
  }
}

function masterGainNode(): GainNode | null {
  try {
    const g = getSuperdoughAudioController()?.output?.destinationGain;
    return g instanceof GainNode ? g : null;
  } catch {
    return null;
  }
}

/** 정지 시 이미 스케줄된 WebAudio 잔향을 짧게 죽인다. */
export function duckMaster(fadeSec = MASTER_DUCK_SEC): void {
  const g = masterGainNode();
  if (!g) return;
  const ctx = getAudioContext() as AudioContext;
  const now = ctx.currentTime;
  try {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
    g.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.008, fadeSec));
  } catch (err) {
    console.warn("duckMaster failed", err);
  }
}

/** 재생 직전 마스터를 다시 연다. */
export function openMaster(fadeSec = MASTER_OPEN_SEC): void {
  const g = masterGainNode();
  if (!g) return;
  const ctx = getAudioContext() as AudioContext;
  const now = ctx.currentTime;
  try {
    g.gain.cancelScheduledValues(now);
    const cur = Math.max(g.gain.value, 0.0001);
    g.gain.setValueAtTime(cur, now);
    g.gain.linearRampToValueAtTime(1, now + Math.max(0.004, fadeSec));
  } catch (err) {
    console.warn("openMaster failed", err);
  }
}

/**
 * AudioContext running 보장.
 * superdough initAudio의 resume 조건이 깨져 있어 여기서 명시 resume.
 */
export async function ensureAudioRunning(): Promise<void> {
  preferPlaybackAudioSession();
  const ctx = getAudioContext() as AudioContext;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  await initAudio();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

export function getAudioState(): string {
  try {
    return (getAudioContext() as AudioContext).state;
  } catch {
    return "missing";
  }
}

async function loadDirtGtr(): Promise<void> {
  if (dirtGtrLoaded) return;
  await samples({ ...DIRT_GTR }, DIRT_BASE);
  dirtGtrLoaded = true;
}

/** 사운드폰트 피치 캐시 — strum 먼저, piano는 백그라운드 */
async function warmPlaybackFonts(): Promise<void> {
  if (fontsWarmed) return;
  const ctx = getAudioContext() as AudioContext;
  const warm = async (font: string, midi: number) => {
    try {
      const src = await getFontBufferSource(font, { note: midi }, ctx);
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    } catch {
      /* warm 실패해도 재생은 진행 */
    }
  };
  // strum만 await — piano SF 전체 로드가 PLAY를 막으며 버벅이는 것 방지
  await Promise.all(WARM_MIDI.map((midi) => warm(STRUM_FONT, midi)));
  fontsWarmed = true;
  void Promise.all(WARM_MIDI.map((midi) => warm(PIANO_FONT, midi)));
}

/** piano 모드 진입 시 호출 — 이미 워밍 중/완료면 즉시 */
let pianoWarm: Promise<void> | null = null;
export function warmPianoFont(): Promise<void> {
  if (!pianoWarm) {
    pianoWarm = (async () => {
      const ctx = getAudioContext() as AudioContext;
      await Promise.all(
        WARM_MIDI.map(async (midi) => {
          try {
            const src = await getFontBufferSource(PIANO_FONT, { note: midi }, ctx);
            try {
              src.disconnect();
            } catch {
              /* ignore */
            }
          } catch {
            /* ignore */
          }
        }),
      );
    })();
  }
  return pianoWarm;
}

export async function initStrudelEngine(): Promise<Repl> {
  if (!boot) {
    boot = initStrudel({
      prebake: async () => {
        registerSoundfonts();
        await loadDirtGtr();
      },
    })
      .then((repl: Repl) => {
        replRef = repl;
        // 첫 타격 스케줄 여유 (폰트 await 대비). 기본 0.1
        if (repl?.scheduler && typeof repl.scheduler.latency === "number") {
          repl.scheduler.latency = 0.14;
        }
        return repl;
      })
      .catch((err: unknown) => {
        boot = null;
        replRef = null;
        throw err;
      });
  }
  return boot;
}

export type EvaluateOpts = {
  /**
   * true면 사이클 0에서 다시 시작 (PLAY).
   * false면 재생 중 핫스왑 (편집).
   */
  syncStart?: boolean;
};

/**
 * Strudel 코드 평가·재생.
 * @returns 이 호출이 여전히 유효한 재생인지 (정지 레이스면 false)
 */
export async function evaluateStrudel(
  code: string,
  opts: EvaluateOpts = {},
): Promise<boolean> {
  const my = epoch;
  lastCode = code;
  const syncStart = opts.syncStart === true;

  const run = async (): Promise<boolean> => {
    if (my !== epoch) return false;
    await initStrudelEngine();
    if (my !== epoch) return false;
    await ensureAudioRunning();
    if (my !== epoch) return false;
    await warmPlaybackFonts();
    if (my !== epoch) return false;
    if (code.includes("gm_piano")) {
      await warmPianoFont();
      if (my !== epoch) return false;
      if (replRef?.scheduler && typeof replRef.scheduler.latency === "number") {
        replRef.scheduler.latency = 0.2;
      }
    } else if (replRef?.scheduler && typeof replRef.scheduler.latency === "number") {
      replRef.scheduler.latency = 0.14;
    }

    openMaster();

    if (syncStart) {
      // 정지 상태에서 사이클 0으로 맞춘 뒤, 패턴만 올리고 start
      try {
        hush();
      } catch {
        /* ignore */
      }
      if (my !== epoch) return false;
      await evaluate(code, false);
      if (my !== epoch) {
        try {
          hush();
        } catch {
          /* ignore */
        }
        duckMaster();
        return false;
      }
      try {
        await replRef?.start?.();
      } catch (err) {
        console.warn("scheduler start failed", err);
        return false;
      }
      // start 이후 gain 그래프가 생겼을 수 있음 — 한 번 더 연다
      openMaster();
    } else {
      await evaluate(code);
      openMaster();
    }

    if (my !== epoch) {
      try {
        hush();
      } catch {
        /* ignore */
      }
      duckMaster();
      return false;
    }
    return true;
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** 재생 중지. 진행 중/대기 중 evaluate는 epoch로 무효화된다. */
export function hushStrudel(): void {
  epoch += 1;
  duckMaster();
  try {
    hush();
  } catch (err) {
    console.warn("hush failed", err);
  }
}
