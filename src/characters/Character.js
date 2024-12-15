import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export class Character {
    constructor(scene, position, playerNumber) {
        this.scene = scene;
        this.position = position;
        this.playerNumber = playerNumber;
        this.anims = null;
        this.mesh = null;
        this.attackBox = null;
        this.isJumping = false;
        this.isAttacking = false;
        this.modelLoaded = false;
        this.isMoving = false;
        this.targetBox = null;
        this.isPropulsed = false;
        this.propulsionForce = 20;
        this.propulsionDuration = 300;
        this.maxHP = 100;
        this.currentHP = 100;
        this.hpBarMesh = null;
        this.hpBarContainer = null;
        this.isDead = false;
        this.gameManager = null;
        this.isInvincible = false;
        // Nouvelles propriétés pour les collisions
        this.wallDamage = 3;
        this.wallBounceForce = 15;
        this.isInCollisionWithWall = false;
        this.hasCollidedWithWall = false;
    }
    async initialize() {
        try {
            console.log("Démarrage du chargement du modèle...");
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "/models/",
                "lePersonnage.glb",
                this.scene
            );
    
            console.log("Modèle chargé avec succès:", result);
            
            this.modelLoaded = true;
            this.anims = result.animationGroups;
            const rootMesh = result.meshes[0];
            
            this.mesh = BABYLON.MeshBuilder.CreateBox("character", {
                depth: 1,
                width: 1,
                height: 2
            }, this.scene);
            
            this.mesh.scaling = new BABYLON.Vector3(6, 5, 6);
            
            rootMesh.parent = this.mesh;
            rootMesh.position.y = -1;
            rootMesh.scaling = new BABYLON.Vector3(1, 1, 1);
            
            this.mesh.position = this.position.clone();
            
            this.mesh.visibility = false;
            
            this.setupAttackBox();
            this.setupHPBar();
            
            this.targetBox = BABYLON.MeshBuilder.CreateBox("targetBox", {
                size: 0.1
            }, this.scene);
            this.targetBox.isPickable = false;
            this.targetBox.isVisible = false;
    
            if (this.anims.length > 0) {
                this.playAnimation("idle", true);
            }
    
            return true;
        } catch (error) {
            console.error("Erreur lors du chargement:", error);
            this.modelLoaded = false;
            return false;
        }
    }

    setupHPBar() {
        this.hpBarContainer = BABYLON.MeshBuilder.CreatePlane("hpBarContainer", {
            width: 2,
            height: 0.2
        }, this.scene);
        
        const containerMaterial = new BABYLON.StandardMaterial("containerMaterial", this.scene);
        containerMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.hpBarContainer.material = containerMaterial;
        
        this.hpBarMesh = BABYLON.MeshBuilder.CreatePlane("hpBar", {
            width: 2,
            height: 0.2
        }, this.scene);
        
        const hpBarMaterial = new BABYLON.StandardMaterial("hpBarMaterial", this.scene);
        hpBarMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
        this.hpBarMesh.material = hpBarMaterial;
        
        this.hpBarContainer.parent = this.mesh;
        this.hpBarMesh.parent = this.hpBarContainer;
        
        this.hpBarContainer.position.y = 3;
        this.hpBarContainer.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    }

    handleWallBounce(collisionPoint) {
        if (this.isPropulsed && !this.hasCollidedWithWall) {
            this.hasCollidedWithWall = true;
            
            // Calculer la direction du rebond (inverse de la direction actuelle)
            const currentDirection = this.mesh.position.subtract(collisionPoint);
            currentDirection.y = 0;
            currentDirection.normalize();
            
            // Appliquer des dégâts supplémentaires
            this.takeDamage(this.wallDamage);
            
            // Créer l'animation de rebond
            BABYLON.Animation.CreateAndStartAnimation(
                "wallBounce",
                this.mesh,
                "position",
                60,
                20,
                this.mesh.position,
                this.mesh.position.add(currentDirection.scale(this.wallBounceForce)),
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            
            // Réinitialiser le statut après un délai
            setTimeout(() => {
                this.hasCollidedWithWall = false;
                this.isPropulsed = false;
            }, this.propulsionDuration);
        }
    }

    takeDamage(damagePercent) {
        if (this.isDead || this.isInvincible) return;
        
        const damage = (this.maxHP * damagePercent) / 100;
        this.currentHP = Math.max(0, this.currentHP - damage);
        
        this.isInvincible = true;
        setTimeout(() => {
            this.isInvincible = false;
        }, 1000);
        
        const hpRatio = this.currentHP / this.maxHP;
        this.hpBarMesh.scaling.x = hpRatio;
        this.hpBarMesh.position.x = -0.5 * (1 - hpRatio);
        
        const material = this.hpBarMesh.material;
        if (hpRatio > 0.5) {
            material.diffuseColor = new BABYLON.Color3(0, 1, 0);
        } else if (hpRatio > 0.25) {
            material.diffuseColor = new BABYLON.Color3(1, 1, 0);
        } else {
            material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        }
        
        if (this.currentHP <= 0 && !this.isDead) {
            this.die();
        }
    }

    die() {
        if (this.isDead) return;
        
        this.isDead = true;
        this.playAnimation("knock", true);
        
        if (this.gameManager) {
            this.gameManager.handlePlayerDeath(this.playerNumber);
        }
    }

    setupAttackBox() {
        if (!this.mesh) return;

        this.attackBox = BABYLON.MeshBuilder.CreateBox("attack_box", { 
            size: 0.5
        }, this.scene);
        
        this.attackBox.isPickable = false;
        this.attackBox.visibility = false;
        this.attackBox.parent = this.mesh;
        this.attackBox.position = new BABYLON.Vector3(0.37, 0, 0.10);
        
        const attackBoxMat = new BABYLON.StandardMaterial("attackBoxMat", this.scene);
        attackBoxMat.diffuseColor = new BABYLON.Color3(1, 1, 0);
        this.attackBox.material = attackBoxMat;
    }

    playAnimation(animName, loop = false) {
        if (!this.anims || !this.modelLoaded) return;
        
        console.log("Playing animation:", animName);
        
        this.anims.forEach((anim) => {
            if (anim.name === animName) {
                if (!anim.isPlaying) {
                    anim.play(loop);
                    switch(animName) {
                        case "running": anim.speedRatio = 2; break;
                        case "jump": anim.speedRatio = 1.5; break;
                        case "attack": anim.speedRatio = 3; break;
                        default: anim.speedRatio = 1;
                    }
                }
            } else if (anim.isPlaying) {
                anim.stop();
            }
        });
    }

    move(moveVector) {
        if (!this.mesh || this.isAttacking || this.isPropulsed || this.isDead) return;
        
        if (moveVector.length() > 0) {
            this.isMoving = true;

            const targetVector = this.mesh.position.add(moveVector);
            this.mesh.lookAt(targetVector);
            this.mesh.rotation.y += Math.PI;
            this.mesh.position.addInPlace(moveVector);

            if (!this.isJumping && !this.isAttacking && this.modelLoaded) {
                this.playAnimation("running", true);
            }
        } else {
            this.isMoving = false;
            if (this.anims && this.modelLoaded) {
                this.anims.forEach((anim) => {
                    if (anim.name === "running") {
                        anim.stop();
                    }
                });
                this.playAnimation("idle", true);
            }
        }
    }

    jump() {
        if (this.isJumping || !this.mesh || this.isPropulsed || this.isDead) return;
        
        this.isJumping = true;
        
        if (this.modelLoaded) {
            this.playAnimation("jump", false);
        }

        const jumpHeight = 5;
        const jumpDuration = 60;
        
        BABYLON.Animation.CreateAndStartAnimation(
            "jumpUp",
            this.mesh,
            "position.y",
            60,
            jumpDuration / 2,
            this.mesh.position.y,
            this.mesh.position.y + jumpHeight,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        setTimeout(() => {
            BABYLON.Animation.CreateAndStartAnimation(
                "jumpDown",
                this.mesh,
                "position.y",
                60,
                jumpDuration / 2,
                this.mesh.position.y + jumpHeight,
                this.position.y,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );
        }, (jumpDuration / 2) * (1000 / 60));

        setTimeout(() => {
            this.isJumping = false;
            if (!this.isMoving && !this.isAttacking && this.modelLoaded) {
                this.playAnimation("idle", true);
            }
        }, jumpDuration * (1000 / 60));
    }

    attack() {
        if (this.isAttacking || !this.mesh || this.isPropulsed || this.isDead) return;
        
        this.isAttacking = true;
        const ATTACK_DURATION = 400;
        
        if (this.modelLoaded) {
            this.playAnimation("attack", false);
        }
    
        if (this.attackBox) {
            const initialPosition = this.attackBox.position.clone();
            const attackPosition = new BABYLON.Vector3(
                initialPosition.x,
                initialPosition.y,
                initialPosition.z-2
            );
    
            BABYLON.Animation.CreateAndStartAnimation(
                "attackBoxForward",
                this.attackBox,
                "position",
                60,
                10,
                initialPosition,
                attackPosition,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );
    
            this.attackBox.visibility = false;
    
            setTimeout(() => {
                BABYLON.Animation.CreateAndStartAnimation(
                    "attackBoxReturn",
                    this.attackBox,
                    "position",
                    60,
                    10,
                    attackPosition,
                    initialPosition,
                    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                );
                
                this.attackBox.visibility = false;
            }, ATTACK_DURATION - 200);
    
            setTimeout(() => {
                this.isAttacking = false;
                this.attackBox.position = initialPosition.clone();
                
                if (!this.isJumping && !this.isMoving && this.modelLoaded) {
                    this.playAnimation("idle", true);
                }
            }, ATTACK_DURATION);
        }
    }
    
    propulse(direction) {
        if (this.isDead || this.hasCollidedWithWall) return;
        
        this.isPropulsed = true;
        const propulsionDistance = this.propulsionForce;
        
        // Calculer la position finale prévue
        const targetPosition = this.mesh.position.add(direction.scale(propulsionDistance));
        
        // Vérifier si la position finale est dans l'arène
        if (!this.gameManager.isWithinArena(targetPosition)) {
            // Point d'intersection avec le mur
            const currentPos = this.mesh.position.clone();
            const distanceToCenter = Math.sqrt(
                targetPosition.x * targetPosition.x + 
                targetPosition.z * targetPosition.z
            );
            
            const collisionPoint = new BABYLON.Vector3(
                (this.gameManager.arenaBoundary / distanceToCenter) * targetPosition.x,
                targetPosition.y,
                (this.gameManager.arenaBoundary / distanceToCenter) * targetPosition.z
            );

            // Animation jusqu'au point de collision
            BABYLON.Animation.CreateAndStartAnimation(
                "propulsionToWall",
                this.mesh,
                "position",
                60,
                15,
                this.mesh.position,
                collisionPoint,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            // Après collision avec le mur
            setTimeout(() => {
                if (!this.hasCollidedWithWall) {
                    this.hasCollidedWithWall = true;
                    
                    // Calculer la direction du rebond
                    const bounceDirection = direction.scale(-1); // Direction opposée
                    bounceDirection.normalize();

                    // Appliquer des dégâts supplémentaires
                    this.takeDamage(this.wallDamage);

                    // Animation de rebond
                    BABYLON.Animation.CreateAndStartAnimation(
                        "wallBounce",
                        this.mesh,
                        "position",
                        60,
                        20,
                        this.mesh.position,
                        this.mesh.position.add(bounceDirection.scale(this.wallBounceForce)),
                        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                    );

                    // Réinitialiser après le rebond
                    setTimeout(() => {
                        this.hasCollidedWithWall = false;
                        this.isPropulsed = false;
                        this.isInCollisionWithWall = false;
                    }, this.propulsionDuration);
                }
            }, 250); // Délai avant le rebond
        } else {
            // Propulsion normale si pas de collision prévue
            BABYLON.Animation.CreateAndStartAnimation(
                "propulsion",
                this.mesh,
                "position",
                60,
                20,
                this.mesh.position,
                targetPosition,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            setTimeout(() => {
                this.isPropulsed = false;
            }, this.propulsionDuration);
        }
    }

    dispose() {
        if (this.mesh) {
            this.mesh.dispose();
        }
        
        if (this.attackBox) {
            this.attackBox.dispose();
        }

        if (this.targetBox) {
            this.targetBox.dispose();
        }
        
        if (this.hpBarMesh) {
            this.hpBarMesh.dispose();
        }
        
        if (this.hpBarContainer) {
            this.hpBarContainer.dispose();
        }
        
        if (this.anims) {
            this.anims.forEach(anim => anim.dispose());
        }
    }
}