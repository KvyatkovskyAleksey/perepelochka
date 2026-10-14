import { createContext, ReactElement, ReactNode, useState } from "react";
import { Synth } from "tone";
import * as Tone from "tone";
import { ZIndexUtils } from "primereact/utils";

interface ToneContextProps {
  toneStarted: boolean;
  synth: Synth;
  triggerAttackRelease: (
    note: Tone.Unit.Frequency,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time | undefined,
    velocity?: number | undefined,
  ) => void;
}

export const ToneContext = createContext<ToneContextProps>(null!);

interface ToneProviderProps {
  children: ReactNode | ReactElement[];
}

export default function ToneProvider({ children }: ToneProviderProps) {
  const [toneStarted, setToneStarted] = useState(false);
  const synth = new Tone.Synth().toDestination();
  async function triggerAttackRelease(
    note: Tone.Unit.Frequency,
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time | undefined,
    velocity?: number | undefined,
  ) {
    if (!toneStarted) {
      await Tone.start();
      setToneStarted(true);
    }
    synth.triggerAttackRelease(note, duration, time, velocity);
  }
  return (
    <ToneContext.Provider
      value={{ toneStarted, synth, triggerAttackRelease }}
    ></ToneContext.Provider>
  );
}
