// GameInterface.jsx
import { useState } from 'react';

export default function GameInterface({ gameManager }) {
    const [player1, setPlayer1] = useState('');
    const [player2, setPlayer2] = useState('');
    const [isGameStarted, setIsGameStarted] = useState(false);

    const handleStartGame = async () => {
        if (player1.trim() && player2.trim()) {
            // Configurer le callback de reset avant de démarrer
            gameManager.onGameReset = () => {
                setIsGameStarted(false);
                setPlayer1('');
                setPlayer2('');
            };
            
            // Démarrer le jeu
            await gameManager.createCharacters(player1, player2);
            setIsGameStarted(true);
        }
    };

    if (isGameStarted) {
        return null;
    }

    return (
        <div className="game-form">
            <h1>UFC UBO</h1>
            <div>
                <label>Casse gueule 1</label>
                <input
                    type="text"
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="Entrez votre pseudo"
                />
            </div>
            
            <div>
                <label>Casse gueule 2</label>
                <input
                    type="text"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="Entrez votre pseudo"
                />
            </div>
            
            <button
                onClick={handleStartGame}
                disabled={!player1.trim() || !player2.trim()}
            >
                Commencer le cassage de bouche
            </button>
        </div>
    );
}