"use client";

import React from "react";
// import * as Tone from "tone";
import styles from "./string.module.css";
import * as Tone from "tone";

interface StringProps {
  soundName: string;
  width: string | number;
}

const StringComponent: React.FC<StringProps> = ({ soundName, width }) => {
  const handleClick = async () => {
    await Tone.start();
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(soundName, "8n");
  };

  return (
    <button
      data-testid="string"
      onClick={handleClick}
      className={styles.string}
      style={{ width }}
    ></button>
  );
};

export default StringComponent;
