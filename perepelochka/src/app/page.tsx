import styles from "./page.module.css";
import Cymbals from "@/Components/Cymbals";

export default function Home() {
  return (
    <main className={styles.main}>
      <Cymbals />
    </main>
  );
}
