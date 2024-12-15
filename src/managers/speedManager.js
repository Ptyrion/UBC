// managers/speedManager.js
import { MOVEMENT } from './gameConstants.js';  // notez le .js à la fin

export class SpeedManager {
    constructor() {
        this._baseMovementSpeed = MOVEMENT.BASE_SPEED;
        console.log('SpeedManager initialized with speed:', this._baseMovementSpeed);
    }

    get baseSpeed() {
        return this._baseMovementSpeed;
    }

    reset() {
        this._baseMovementSpeed = MOVEMENT.BASE_SPEED;
        console.log('Speed reset to:', this._baseMovementSpeed);
    }
}