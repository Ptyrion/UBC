import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import '@babylonjs/gui';
import * as GUI from '@babylonjs/gui';
import * as CANNON from 'cannon';
import { Character } from '../characters/Character';
import { MainMap } from '../maps/MainMap';

window.CANNON = CANNON;

export class GameManager {
    constructor() {
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.characters = [];
        this.map = null;
        this.inputMap = {};
        this.activeCharacter = null;
        this.isPropulsed = false;
        this.propulsionForce = 20;
        this.propulsionDuration = 300;
        this.isGameOver = false;
        this.onGameReset = null;
        this.player1Name = '';
        this.player2Name = '';
        this.canvas = null;
        this.baseMovementSpeed = 20;

        // Vecteurs réutilisables pour l'optimisation
        this._moveVector1 = new BABYLON.Vector3(0, 0, 0);
        this._moveVector2 = new BABYLON.Vector3(0, 0, 0);
        this._rotatedMove = new BABYLON.Vector3(0, 0, 0);
        
        // Paramètres de l'arène
        this.arenaRadius = 80;
        this.arenaBoundary = 75;
    }

    async initialize(canvas) {
        this.canvas = canvas;
        if (!this.engine) {
            this.engine = new BABYLON.Engine(canvas, true);
        }
        this.setupInputHandling();
        await this.setupScene();
    }

    setupInputHandling() {
        if (!this.inputMap) {
            this.inputMap = {};
        }
        window.addEventListener("keydown", (evt) => this.inputMap[evt.key.toLowerCase()] = true);
        window.addEventListener("keyup", (evt) => this.inputMap[evt.key.toLowerCase()] = false);
        window.addEventListener("resize", () => this.engine?.resize());
    }

    async setupScene() {
        if (this.scene) {
            this.scene.dispose();
        }

        this.scene = new BABYLON.Scene(this.engine);
        const gravityVector = new BABYLON.Vector3(0, 0, 0);
        const physicsPlugin = new BABYLON.CannonJSPlugin();
        this.scene.enablePhysics(gravityVector, physicsPlugin);
    
        this.map = new MainMap(this.scene);
        await this.map.initialize();
    
        this.setupCamera();
        this.setupGameLoop();
    }

    async createCharacters(player1Name, player2Name) {
        this.player1Name = player1Name;
        this.player2Name = player2Name;

        if (!this.scene || this.scene.isDisposed) {
            await this.setupScene();
        }
        
        const character1 = new Character(
            this.scene, 
            new BABYLON.Vector3(-20, 7, 0),
            1
        );
        character1.gameManager = this;
        await character1.initialize();
        this.addNameLabel(character1.mesh, player1Name);
        
        const character2 = new Character(
            this.scene, 
            new BABYLON.Vector3(20, 7, 0),
            2
        );
        character2.gameManager = this;
        await character2.initialize();
        this.addNameLabel(character2.mesh, player2Name);

        this.characters = [character1, character2];
        this.activeCharacter = character1;
        
        this.engine.runRenderLoop(() => {
            if (this.scene && !this.scene.isDisposed) {
                this.scene.render();
            }
        });
    }

    setupCamera() {
        if (this.camera) {
            this.camera.dispose();
        }

        this.camera = new BABYLON.ArcRotateCamera(
            "ArcRotateCamera",
            BABYLON.Tools.ToRadians(0),
            BABYLON.Tools.ToRadians(60),
            150,
            new BABYLON.Vector3(0, 0, 0),
            this.scene
        );
    
        this.camera.lowerRadiusLimit = 100;
        this.camera.upperRadiusLimit = 200;
        this.camera.lowerBetaLimit = BABYLON.Tools.ToRadians(30);
        this.camera.upperBetaLimit = BABYLON.Tools.ToRadians(80);
    
        this.camera.attachControl(true);
        
        this.camera.keysUp = [38];
        this.camera.keysDown = [40];
        this.camera.keysLeft = [37];
        this.camera.keysRight = [39];
    }

    setupGameLoop() {
        if (this.scene.isDisposed) return;

        this.scene.registerBeforeRender(() => {
            if (this.isGameOver || !this.scene || this.scene.isDisposed) return;

            this.handlePlayerMovement(1, this._moveVector1, "z", "s", "d", "q", "e", "a");
            this.handlePlayerMovement(2, this._moveVector2, "i", "k", "l", "j", "o", "u");

            if (this.characters.length >= 2) {
                this.checkAttackCollisions(this.characters[0], this.characters[1]);
                this.checkAttackCollisions(this.characters[1], this.characters[0]);
            }
        });
    }

    handlePlayerMovement(playerIndex, moveVector, forwardKey, backKey, rightKey, leftKey, jumpKey, attackKey) {
        const character = this.characters[playerIndex - 1];
        if (!character) return;

        moveVector.setAll(0);

        if (this.inputMap[forwardKey]) moveVector.z = 1;
        if (this.inputMap[backKey]) moveVector.z = -1;
        if (this.inputMap[rightKey]) moveVector.x = 1;
        if (this.inputMap[leftKey]) moveVector.x = -1;
        if (this.inputMap[jumpKey]) character.jump();
        if (this.inputMap[attackKey]) character.attack();

        if (moveVector.length() > 0) {
            moveVector.normalize();
            const cameraRotation = this.camera.alpha;
            
            this._rotatedMove.x = moveVector.x * Math.cos(cameraRotation) + moveVector.z * Math.sin(cameraRotation);
            this._rotatedMove.y = 0;
            this._rotatedMove.z = moveVector.z * Math.cos(cameraRotation) - moveVector.x * Math.sin(cameraRotation);
            
            this._rotatedMove.scaleInPlace(this.baseMovementSpeed * 0.016);
            
            const newPosition = character.mesh.position.add(this._rotatedMove);
            if (this.isWithinArena(newPosition)) {
                character.move(this._rotatedMove);
            } else {
                this.handleBoundaryCollision(character, this._rotatedMove);
            }
        } else {
            character.move(moveVector);
        }
    }

    handlePotentialWallCollision(character, targetPosition) {
        const currentPos = character.mesh.position;
        const direction = targetPosition.subtract(currentPos);
        direction.normalize();
        
        // Calculer le point d'intersection avec la limite de l'arène
        const distanceToCenter = Math.sqrt(
            targetPosition.x * targetPosition.x + 
            targetPosition.z * targetPosition.z
        );
        
        if (distanceToCenter > this.arenaBoundary) {
            const collisionPoint = new BABYLON.Vector3(
                (this.arenaBoundary / distanceToCenter) * targetPosition.x,
                targetPosition.y,
                (this.arenaBoundary / distanceToCenter) * targetPosition.z
            );
            
            // Déclencher le rebond sur le mur
            character.handleWallBounce(collisionPoint);
        }
    }

    isWithinArena(position) {
        return Math.sqrt(position.x * position.x + position.z * position.z) <= this.arenaBoundary;
    }

    handleBoundaryCollision(character, moveVector) {
        const currentPosition = character.mesh.position;
        const directionToCenter = currentPosition.scale(-1);
        directionToCenter.y = 0;
        directionToCenter.normalize();

        const dot = BABYLON.Vector3.Dot(moveVector, directionToCenter);
        const projection = directionToCenter.scale(dot);
        const tangent = moveVector.subtract(projection);

        if (tangent.length() > 0) {
            const newPosition = character.mesh.position.add(tangent);
            if (this.isWithinArena(newPosition)) {
                character.move(tangent);
            }
        }
    }

    addNameLabel(characterMesh, playerName) {
        const plane = BABYLON.MeshBuilder.CreatePlane("nameplate", { width: 2, height: 0.5 }, this.scene);
        const texture = new BABYLON.DynamicTexture("nameTexture", { width: 256, height: 128 }, this.scene);
        const context = texture.getContext();
        
        const fontSize = 48;
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = "white";
        context.textAlign = "center";
        context.clearRect(0, 0, 256, 128);
        context.fillText(playerName, 128, 64);
        
        texture.update();
        
        const material = new BABYLON.StandardMaterial("nameMaterial", this.scene);
        material.diffuseTexture = texture;
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        material.backFaceCulling = false;
        
        plane.material = material;
        plane.parent = characterMesh;
        plane.position.y = 2.5;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    }

    checkAttackCollisions(attacker, defender) {
        if (!this.scene || this.scene.isDisposed || this.isGameOver) return;
        if (!attacker.isAttacking || !attacker.attackBox || !defender.mesh || 
            defender.isDead || defender.isInvincible || defender.isPropulsed) return;

        const attackBox = attacker.attackBox;
        const defenderMesh = defender.mesh;

        if (attackBox.intersectsMesh(defenderMesh, false)) {
            defender.takeDamage(15);

            if (!defender.isDead) {
                // Calculer la direction de propulsion
                const direction = defender.mesh.position.subtract(attacker.mesh.position);
                direction.y = 0;
                direction.normalize();
                
                // Lancer la propulsion avec le nouveau système
                defender.propulse(direction);
            }
        }
    }

    isWithinArena(position) {
        return Math.sqrt(position.x * position.x + position.z * position.z) <= this.arenaBoundary;
    }

    getDistanceFromCenter(position) {
        return Math.sqrt(position.x * position.x + position.z * position.z);
    }

    handlePlayerDeath(defeatedPlayerNumber) {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        const winnerNumber = defeatedPlayerNumber === 1 ? 2 : 1;
        const winnerName = winnerNumber === 1 ? this.player1Name : this.player2Name;
        
        if (!this.scene.gui) {
            this.scene.gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        }

        const container = new GUI.StackPanel();
        container.width = "400px";
        container.height = "300px";
        container.paddingTop = "20px";
        container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        this.scene.gui.addControl(container);

        const titleText = new GUI.TextBlock();
        titleText.text = `VICTOIRE !`;
        titleText.color = "gold";
        titleText.fontSize = 48;
        titleText.height = "60px";
        container.addControl(titleText);

        const winnerText = new GUI.TextBlock();
        winnerText.text = `${winnerName} est victorieux !`;
        winnerText.color = "white";
        winnerText.fontSize = 24;
        winnerText.height = "40px";
        container.addControl(winnerText);

        const button = GUI.Button.CreateSimpleButton("resetButton", "Retour au menu");
        button.width = "200px";
        button.height = "40px";
        button.color = "white";
        button.background = "green";
        button.thickness = 2;
        button.cornerRadius = 10;
        button.paddingTop = "20px";
        button.onPointerClickObservable.add(() => {
            this.resetGame();
        });
        container.addControl(button);

        const fadeIn = new BABYLON.Animation(
            "fadeIn",
            "alpha",
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keyFrames = [];
        keyFrames.push({ frame: 0, value: 0 });
        keyFrames.push({ frame: 60, value: 1 });
        fadeIn.setKeys(keyFrames);

        container.animations = [];
        container.animations.push(fadeIn);

        this.scene.beginAnimation(container, 0, 60);
        
        this.inputMap = {};
    }

    resetGame() {
        this.engine.stopRenderLoop();
        
        if (this.scene && this.scene.gui) {
            this.scene.gui.dispose();
        }

        this.dispose();
        
        this.player1Name = '';
        this.player2Name = '';
        
        if (this.onGameReset) {
            this.onGameReset();
        }
    }

    dispose() {
        if (this.characters) {
            this.characters.forEach(character => character.dispose());
            this.characters = [];
        }

        if (this.map) {
            this.map.dispose();
            this.map = null;
        }

        if (this.camera) {
            this.camera.dispose();
            this.camera = null;
        }

        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }

        this.isGameOver = false;
        this.inputMap = {};
        this.activeCharacter = null;
    }
}