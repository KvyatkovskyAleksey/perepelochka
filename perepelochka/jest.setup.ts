import "@testing-library/jest-dom";

jest.mock("tone/Tone", () => {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    Synth: jest.fn().mockImplementation(() => {
      return {
        toDestination: () => ({ triggerAttackRelease: jest.fn() }),
      };
    }),
  };
});
