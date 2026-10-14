"use client";

import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Reverb, Sampler, Synth } from "tone";
import * as Tone from "tone";

/**
 * Звук струн: сэмплы орфестровой арфы из открытой библиотеки midi-js-soundfonts
 * (MusyngKite, ~244 КБ на 15 нот, лежат в public/sounds/strings),
 * с лёгкой реверберацией. Пока сэмплы грузятся — мгновенный синтезаторный фолбэк.
 */
const STRING_SAMPLES: Record<string, string> = {
  G4: "G4.mp3",
  A4: "A4.mp3",
  B4: "B4.mp3",
  C5: "C5.mp3",
  D5: "D5.mp3",
  E5: "E5.mp3",
  "F#5": "Fs5.mp3",
  G5: "G5.mp3",
  A5: "A5.mp3",
  B5: "B5.mp3",
  C6: "C6.mp3",
  D6: "D6.mp3",
  E6: "E6.mp3",
  "F#6": "Fs6.mp3",
  G6: "G6.mp3",
};

interface ToneContextProps {
  toneStarted: boolean;
  samplesReady: boolean;
  triggerAttackRelease: (
    note: Tone.Unit.Frequency,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time | undefined,
    velocity?: number | undefined,
  ) => void;
  releaseAll: () => void;
}

export const ToneContext = createContext<ToneContextProps>(null!);

interface ToneProviderProps {
  children: ReactNode | ReactElement[];
}

export default function ToneProvider({ children }: ToneProviderProps) {
  const [toneStarted, setToneStarted] = useState(false);
  const [samplesReady, setSamplesReady] = useState(false);

  const synthRef = useRef<Synth | null>(null);
  const samplerRef = useRef<Sampler | null>(null);
  const samplesReadyRef = useRef(false);

  useEffect(() => {
    // общий хвост: лёгкая комната, чтобы струна «дышала»
    const reverb = new Reverb({ decay: 1.9, preDelay: 0.02, wet: 0.28 }).toDestination();

    // фолбэк-синтезатор (пока сэмплы не загрузились)
    const synth = new Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.25, sustain: 0.25, release: 0.7 },
      volume: -6,
    }).connect(reverb);
    synthRef.current = synth;

    // настоящие струны
    const sampler = new Sampler({
      urls: STRING_SAMPLES,
      baseUrl: "/sounds/strings/",
      release: 1.1,
      onload: () => {
        samplesReadyRef.current = true;
        setSamplesReady(true);
      },
    }).connect(reverb);
    samplerRef.current = sampler;

    Tone.start().then(() => setToneStarted(true));

    return () => {
      sampler.dispose();
      synth.dispose();
      reverb.dispose();
      synthRef.current = null;
      samplerRef.current = null;
      samplesReadyRef.current = false;
      setSamplesReady(false);
    };
  }, []);

  const triggerAttackRelease = useCallback(
    (note: Tone.Unit.Frequency, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) => {
      const sampler = samplerRef.current;
      if (samplesReadyRef.current && sampler) {
        sampler.triggerAttackRelease(note, duration, time, velocity);
      } else {
        synthRef.current?.triggerAttackRelease(note, duration, time, velocity);
      }
    },
    [],
  );

  const releaseAll = useCallback(() => {
    samplerRef.current?.releaseAll();
    synthRef.current?.triggerRelease();
  }, []);

  return (
    <ToneContext.Provider value={{ toneStarted, samplesReady, triggerAttackRelease, releaseAll }}>
      {children}
    </ToneContext.Provider>
  );
}
