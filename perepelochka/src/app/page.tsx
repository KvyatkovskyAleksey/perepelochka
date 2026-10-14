import styles from "./page.module.css";
import Workbench from "@/Components/Workbench/Workbench";
import ToneProvider from "@/contexts/toneContext";

export default function Home() {
  return (
    <main className={styles.main}>
      <ToneProvider>
        <Workbench />
      </ToneProvider>
    </main>
  );
}
