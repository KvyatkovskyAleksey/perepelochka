import { Midi } from "@tonejs/midi";
import { inspectMidi, melodyFromMidi } from "./midi";

function buildTestMidi(): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(60); // 1 секунда = 1 доля для предсказуемости
  const melody = midi.addTrack();
  melody.name = "Melody";
  [72, 72, 79, 79, 81, 81, 79].forEach((pitch, i) => {
    melody.channel = 0;
    melody.instrument.number = 0;
    melody.addNote({ midi: pitch, time: i, duration: 0.9, velocity: 0.8 });
  });
  const chords = midi.addTrack();
  chords.name = "Acc";
  chords.channel = 1;
  for (let i = 0; i < 4; i++) {
    [48, 52, 55].forEach((pitch) => {
      chords.addNote({ midi: pitch, time: i, duration: 1.8, velocity: 0.8 });
    });
  }
  return midi.toArray().buffer as ArrayBuffer;
}

describe("inspectMidi", () => {
  it("выбирает монофонический трек, а не аккомпанемент", () => {
    const info = inspectMidi(buildTestMidi());
    expect(info.candidates).toHaveLength(2);
    const [best] = info.candidates;
    expect(best.index).toBe(0);
    expect(best.name).toBe("Melody");
    expect(best.monoFraction).toBe(1);
    expect(info.tempo).toBe(60);
  });

  it("бросает ошибку на не-MIDI данных", () => {
    expect(() => inspectMidi(new TextEncoder().encode("hello").buffer as ArrayBuffer)).toThrow();
  });
});

describe("melodyFromMidi", () => {
  it("читает ноты выбранного трека в долях", () => {
    const buf = buildTestMidi();
    const m = melodyFromMidi(buf, { trackIndex: 0, name: "My tune", fileName: "t.mid" });
    expect(m.name).toBe("My tune");
    expect(m.notes).toHaveLength(7);
    expect(m.notes[0]).toEqual({ midi: 72, startBeats: 0, durBeats: 0.9 });
    expect(m.notes[3].startBeats).toBe(3);
    expect(m.source?.kind).toBe("midi");
  });
});
