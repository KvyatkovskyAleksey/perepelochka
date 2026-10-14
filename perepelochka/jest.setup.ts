import "@testing-library/jest-dom";

jest.mock("tone", () => {
  const connectable = () => ({
    connect: jest.fn().mockReturnThis(),
    toDestination: jest.fn().mockReturnThis(),
    dispose: jest.fn(),
    triggerAttackRelease: jest.fn(),
    triggerRelease: jest.fn(),
    releaseAll: jest.fn(),
    start: jest.fn(),
  });
  return {
    start: jest.fn().mockResolvedValue(undefined),
    now: jest.fn(() => 0),
    Synth: jest.fn().mockImplementation(() => connectable()),
    Sampler: jest.fn().mockImplementation(() => connectable()),
    Reverb: jest.fn().mockImplementation(() => connectable()),
    Part: jest.fn().mockImplementation(() => ({ start: jest.fn(), dispose: jest.fn() })),
    Transport: {
      bpm: { value: 0 },
      seconds: 0,
      start: jest.fn(),
      stop: jest.fn(),
      cancel: jest.fn(),
    },
  };
});
