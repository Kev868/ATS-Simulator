import { useState } from 'react';
import type { CircuitModel } from '../core/types';
import { MainMenu } from './MainMenu';
import { EditorView } from './Editor/EditorView';
import { SimulatorView } from './Simulator/SimulatorView';
import { createEmptyCircuit } from '../core/serialization';
import { ConfirmModal } from './shared/ConfirmModal';

type Screen = "menu" | "editor" | "simulator";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentModel, setCurrentModel] = useState<CircuitModel>(createEmptyCircuit);
  const [confirmBack, setConfirmBack] = useState<{ onConfirm: () => void } | null>(null);

  const goToMenu = () => setScreen("menu");

  const handleLoadCircuit = (model: CircuitModel, startInSimulator: boolean) => {
    setCurrentModel(model);
    setScreen(startInSimulator ? "simulator" : "editor");
  };

  const handleBuildNew = () => {
    setCurrentModel(createEmptyCircuit());
    setScreen("editor");
  };

  const handleRunSimulation = (model: CircuitModel) => {
    setCurrentModel(model);
    setScreen("simulator");
  };

  const handleEditorBack = () => {
    setConfirmBack({
      onConfirm: () => {
        setConfirmBack(null);
        goToMenu();
      },
    });
  };

  return (
    <>
      {screen === "menu" && (
        <MainMenu
          onLoadCircuit={handleLoadCircuit}
          onBuildNew={handleBuildNew}
        />
      )}
      {screen === "editor" && (
        <EditorView
          initialModel={currentModel}
          onRunSimulation={handleRunSimulation}
          onBack={handleEditorBack}
        />
      )}
      {screen === "simulator" && (
        <SimulatorView
          initialModel={currentModel}
          onBack={goToMenu}
          onEditCircuit={() => setScreen("editor")}
        />
      )}
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
