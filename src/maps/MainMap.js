import * as BABYLON from '@babylonjs/core';

export class MainMap {
    constructor(scene) {
        this.scene = scene;
    }

    initialize() {
        // Enable physics in the scene with a lower gravity vector
        const gravityVector = new BABYLON.Vector3(0, -4, 0);  // Reduced gravity
        const physicsPlugin = new BABYLON.CannonJSPlugin();
        this.scene.enablePhysics(gravityVector, physicsPlugin);

        // =======================
        // Création de ground2 Octogonal
        // =======================
        const octagonSides = 8;
        const octagonRadius = 80; // Rayon de l'octogone
        const ground2Thickness = 2; // Épaisseur de ground2
        
        // Créer ground2 en utilisant CreateCylinder avec 8 côtés pour un octogone parfait
        const ground2 = BABYLON.MeshBuilder.CreateCylinder("ground2", {
            diameter: 2 * octagonRadius * 1.08, // Diamètre basé sur le rayon
            height: ground2Thickness,
            tessellation: octagonSides, // 8 côtés pour un octogone
            sideOrientation: BABYLON.Mesh.DOUBLESIDE // Pour que les deux faces soient visibles
        }, this.scene);

        // Positionner ground2 légèrement au-dessus du sol existant
        ground2.position.y = ground2Thickness / 2 + 0.1;

        // Appliquer une rotation de 45 degrés autour de l'axe Y
        ground2.rotation.y = BABYLON.Tools.ToRadians(22.5);

        // =======================
        // Appliquer la texture au matériau de ground2
        // =======================
        const ground2Material = new BABYLON.StandardMaterial("ground2Material", this.scene);

        // Charger la texture depuis le dossier 'textures'
        ground2Material.diffuseTexture = new BABYLON.Texture("src/textures/metal.jpg", this.scene);

        // Appliquer le matériau au sol octogonal
        ground2.material = ground2Material;

        // Si nécessaire, ajuster le tiling de la texture
        ground2Material.diffuseTexture.uScale = 2000; // Répéter la texture horizontalement
        ground2Material.diffuseTexture.vScale = 2000; // Répéter la texture verticalement

        // Appliquer l'imposteur de physique à ground2 avec moins de restitution et de friction
        ground2.physicsImpostor = new BABYLON.PhysicsImpostor(
            ground2,
            BABYLON.PhysicsImpostor.CylinderImpostor,
            { mass: 0, restitution: 0.3, friction: 0.2 },  // Lower restitution and friction
            this.scene
        );
        ground2.checkCollisions = true;

        // =======================
        // Création des Murs Autour de ground2 Octogonal
        // =======================
        const wallHeight = 10; // Hauteur des murs
        const wallThickness = 1; // Épaisseur des murs

        // Calculer la longueur d'un côté de l'octogone
        const sideLength = 2 * octagonRadius * Math.sin(Math.PI / octagonSides) + 5; // s = 2r sin(π/n)

        // Paramètres de l'octogone
        const wallAngleIncrement = (2 * Math.PI) / octagonSides; // 45 degrés pour un octogone

        // Créer les 8 murs autour de ground2
        for (let i = 0; i < octagonSides; i++) {
            const angle = i * wallAngleIncrement; // Rotation de 45 degrés pour chaque côté
            const x = octagonRadius * Math.sin(angle); // Calculer la position x
            const z = octagonRadius * Math.cos(angle); // Calculer la position z
            const rotation = 0 + angle + Math.PI; // Ajuster la rotation pour le mur

            const wall = BABYLON.MeshBuilder.CreateBox(
                `wall2_${i}`,
                { width: sideLength, height: wallHeight, depth: wallThickness },
                this.scene
            );

            // Positionner le mur
            wall.position = new BABYLON.Vector3(x, wallHeight / 2, z);

            // Rotation du mur
            wall.rotation.y = rotation;

            // Appliquer le matériau au mur
            wall.material = ground2Material;

            // Appliquer la physique au mur avec moins de restitution et de friction
            wall.physicsImpostor = new BABYLON.PhysicsImpostor(
                wall,
                BABYLON.PhysicsImpostor.BoxImpostor,
                { mass: 0, restitution: 0.3, friction: 0.2 },  // Lower restitution and friction
                this.scene
            );
            wall.checkCollisions = true;
        }

        // =======================
        // Création du Logo au centre de l'arène
        // =======================
        const logoWidth = 100;  // Desired width of the logo
        const logoHeight = logoWidth * (213 / 500);  // Adjust height based on aspect ratio

        const logo = BABYLON.MeshBuilder.CreatePlane("logo", {
            width: logoWidth,
            height: logoHeight
        }, this.scene);
        
        logo.position.y = ground2.position.y + ground2Thickness / 2 + 0.2;
        logo.position.z = 0;
        logo.position.x = 0;

        logo.rotation.x = Math.PI / 2;

        const logoMaterial = new BABYLON.StandardMaterial("logoMaterial", this.scene);
        logoMaterial.diffuseTexture = new BABYLON.Texture("src/textures/logo.svg", this.scene);
        logo.material = logoMaterial;

        logoMaterial.diffuseTexture.hasAlpha = true;

        // =======================
        // Création de la Lumière
        // =======================
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), this.scene);
        light.intensity = 1;

        // =======================
        // Création du Skybox
        // =======================
        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000 }, this.scene);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", this.scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("src/textures/skybox/skybox", this.scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

        // Set scene clear color
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    }

    dispose() {
        // Dispose du sol
        const ground2 = this.scene.getMeshByName("ground2");
        if (ground2) {
            ground2.physicsImpostor?.dispose();
            ground2.dispose();
        }

        // Dispose des murs
        for (let i = 0; i < 8; i++) {
            const wall = this.scene.getMeshByName(`wall2_${i}`);
            if (wall) {
                wall.physicsImpostor?.dispose();
                wall.dispose();
            }
        }

        // Dispose du logo
        const logo = this.scene.getMeshByName("logo");
        if (logo) {
            logo.dispose();
        }

        // Dispose du skybox
        const skybox = this.scene.getMeshByName("skyBox");
        if (skybox) {
            skybox.dispose();
        }
    }
}