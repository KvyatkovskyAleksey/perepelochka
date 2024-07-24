import React from "react";
import StringComponent from "@/Components/Cymbals/StringComponent";
import styles from "./cymbals.module.css";

const sounds = [
  "G4",
  "A4",
  "B4",
  "C5",
  "D5",
  "E5",
  "F#5",
  "G5",
  "A5",
  "B5",
  "C6",
  "D6",
  "E6",
  "F#6",
  "G6",
];

const Cymbals: React.FunctionComponent = () => {
  return (
    <div>
      <h1>Перепелочка</h1>

      <div className={styles.cymbals}>
        <div className={styles.stringContainer}>
          {sounds.reverse().map((soundName, index) => (
            <StringComponent key={index} soundName={soundName} width="10vh" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cymbals;
