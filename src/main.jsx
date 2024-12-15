import { createRoot } from 'react-dom/client';
import GameInterface from './components/GameInterface';
import { GameManager } from './managers/GameManager';

(async () => {
    const canvas = document.getElementById("renderCanvas");
    const game = new GameManager();
    
    await game.initialize(canvas);
    await game.setupScene(); // Setup la scène avant de monter l'interface
    
    // Monter le composant React avec le gameManager
    const reactContainer = document.getElementById('react-ui');
    if (reactContainer) {
        const root = createRoot(reactContainer);
        root.render(<GameInterface gameManager={game} />);
    }
    
    game.engine.runRenderLoop(() => {
        game.scene.render();
    });
})();