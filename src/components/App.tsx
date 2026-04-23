import { useState, useEffect } from 'react';
import type { CircuitModel } from '../core/types';
import { MainMenu } from './MainMenu';
import { EditorView } from './Editor/EditorView';
import { SimulatorView } from './Simulator/SimulatorView';
import { createEmptyCircuit } from '../core/serialization';
import { ConfirmModal } from './shared/ConfirmModal';

type Screen = "menu" | "editor" | "simulator";

const FADE_OUT_MS = 220;

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [currentModel, setCurrentModel] = useState<CircuitModel>(createEmptyCircuit);
  const [confirmBack, setConfirmBack] = useState<{ onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!prevScreen) return;
    const t = setTimeout(() => setPrevScreen(null), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [prevScreen]);

  const navigate = (next: Screen) => {
    if (next === screen) return;
    setPrevScreen(screen);
    setScreen(next);
  };

  const goToMenu = () => navigate("menu");

  const handleLoadCircuit = (model: CircuitModel, startInSimulator: boolean) => {
    setCurrentModel(model);
    navigate(startInSimulator ? "simulator" : "editor");
  };

  const handleBuildNew = () => {
    setCurrentModel(createEmptyCircuit());
    navigate("editor");
  };

  const handleRunSimulation = (model: CircuitModel) => {
    setCurrentModel(model);
    navigate("simulator");
  };

  const handleEditorBack = () => {
    setConfirmBack({
      onConfirm: () => {
        setConfirmBack(null);
        goToMenu();
      },
    });
  };

  const renderScreen = (s: Screen) => {
    if (s === "menu") return <MainMenu onLoadCircuit={handleLoadCircuit} onBuildNew={handleBuildNew} />;
    if (s === "editor") return <EditorView initialModel={currentModel} onRunSimulation={handleRunSimulation} onBack={handleEditorBack} />;
    return <SimulatorView initialModel={currentModel} onBack={goToMenu} onEditCircuit={() => navigate("editor")} />;
  };

  return (
    <>
      <div className="view-root">
        {prevScreen && (
          <div className="view-layer view-out" key={`out-${prevScreen}`}>
            {renderScreen(prevScreen)}
          </div>
        )}
        <div className="view-layer view-in" key={`in-${screen}`}>
          {renderScreen(screen)}
        </div>
      </div>
      {confirmBack && (
        <ConfirmModal
          message="Return to main menu? Any unsaved changes will be lost."
          onConfirm={confirmBack.onConfirm}
          onCancel={() => setConfirmBack(null)}
        />
      )}
    </>
  );
}
