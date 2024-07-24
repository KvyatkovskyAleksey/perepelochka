import React from "react";
import { render } from "@testing-library/react";
import Cymbals from "@/Components/Cymbals/index";

describe("Cymbals component", () => {
  it("renders without crashing", () => {
    const { getByText } = render(<Cymbals />);
    expect(getByText("Перепелочка")).toBeInTheDocument();
  });

  it("renders correct number of StringComponents", () => {
    const { container } = render(<Cymbals />);
    const stringComponents = container.querySelectorAll(
      "[data-testid='string']",
    );

    expect(stringComponents.length).toBe(15);
  });
});
