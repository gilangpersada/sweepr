import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./components/I18nProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        {/* D-032: `m` + domAnimation keeps the bundle small (`strict` rejects the full `motion`
            component). reducedMotion="user": Windows "Animation effects" off turns off
            movement; opacity fades stay. */}
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </LazyMotion>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
