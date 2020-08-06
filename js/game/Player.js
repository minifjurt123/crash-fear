class Player extends PIXI.Container {
	alive = true
	points = 0
	get isPainting () {
		return this.isPaintingCooldown === 0
	}
	get isMakingHitboxes () {
		// Make hitboxes in reverse proprotionally to velocity (if we go faster we need more frequent hitboxes)
		return this.isMakingHitboxesCooldown === 0 && this.frameCount % Math.ceil(7 / this.velocity) === 0
	}
	get hitBoxSize () {
		return Math.sqrt(2) * this.radius
	}
	get hitBox() {
		return {
			minX: this.x - this.hitBoxSize / 2,
			maxX: this.x + this.hitBoxSize / 2,
			minY: this.y - this.hitBoxSize / 2,
			maxY: this.y + this.hitBoxSize / 2
		}
	}
	get activeEffects () {
		return this.effects.filter(e => !e.timedOut)
	}
	get velocity() {
		return combineMultipliers(this.activeEffects.map(e => e.velocityMultiplier), this.baseVelocity)
	}
	get radius() {
		return combineMultipliers(this.activeEffects.map(e => e.thicknessMultiplier), this.baseRadius)
	}
	get isInvincible () {
		return !this.isPainting || this.activeEffects.some(e => e.invincibility)
	}
	get canTeleportThroughBorders () {
		return this.activeEffects.some(e => e.teleportThroughBorders)
	}
	get hasInvertedControls () {
		return this.activeEffects.some(e => e.invertedControls)
	}
	get turn90Degrees () {
		return this.activeEffects.some(e => e.square)
	}
	isPaintingCooldown = 0
	isMakingHitboxesCooldown = 0
	frameCount = 0
	effects = []
	constructor(options) {
		super()
		this.name = options.name
		this.tailColor = options.color
		if (options.x && options.y && options.direction) {
			this.position.set(options.x, options.y)
			this.direction = options.direction
		}
		// Controls
		const { left, right } = options.controls
		this.leftKey = keyboard(left)
		this.rightKey = keyboard(right)

		this.leftKey.press = () => {
			this.leftWasPressed = true
		}
		this.rightKey.press = () => {
			this.rightWasPressed = true
		}

		// Fixed
		this.baseRadius = 4 // size
		this.baseVelocity = 3
		this.turnVelocity = this.velocity / 50

		// Create head
		this.head = new PIXI.Graphics()
		this.addChild(this.head);
		this.drawHead()

	}
	drawHead() {
		console.log(this.canTeleportThroughBorders)
		this.head.clear()	
		const color = this.hasInvertedControls ? 0x183153 : 0xf1e05a // blue or yellow
		
		this.head.beginFill(color)
		if (this.turn90Degrees) {
			this.head.drawRect(-this.hitBoxSize / 2, -this.hitBoxSize / 2, this.hitBoxSize, this.hitBoxSize)
		} else {
			this.head.drawCircle(0, 0, this.radius)
		}
		this.head.endFill()

		if (this.canTeleportThroughBorders) {
			this.head.alpha = 0.2
		} else {
			this.head.alpha = 1
		}
		// -- Rectangular head --
		// circle.beginFill(0x0000FF)
		// circle.endFill()
		// circle.alpha = 0.5
	}
	randomizePosition(width, height) {
		this.x = Math.random() * width
		this.y = Math.random() * height
		this.direction = Math.random() * 2 * Math.PI
	}
	turn() {
		let left, right
		// if making hard turns, require to let go of button before pressing again
		if (this.turn90Degrees) {
			left = this.leftWasPressed
			right = this.rightWasPressed
		} else {
			left = this.leftKey.isDown
			right = this.rightKey.isDown
		}

		this.leftWasPressed = false
		this.rightWasPressed = false

		// Handle if the player hasInvertedControls
		if (this.hasInvertedControls) {
			[left, right] = [right, left]
		}
		let deltaDirection = this.turn90Degrees ? Math.PI / 2 : this.turnVelocity
		if (left) {
			this.direction = this.direction - deltaDirection
		} else if (right) {
			this.direction = this.direction + deltaDirection
		}
	}
	moveForward() {
		const dx = Math.cos(this.direction) * this.velocity,
			dy = Math.sin(this.direction) * this.velocity
			this.y = this.y + dy
		this.x = this.x + dx
	}
	die() {
		if (this.isInvincible) return
		this.alive = false

	}
	collidesWith(object) {
		// if (!this.isPainting) return false
		return AABBIntersectsAABB(this.hitBox, ObjectToMinMax(object))

	}
	addEffect(effect) {
		this.effects.push(effect)
		if (effect.invincibility) {
			this.isPaintingCooldown = 5
			this.isMakingHitboxesCooldown = 5
		}
		this.drawHead()
		setTimeout(() => {
			if (this.alive) {
				effect.timedOut = true
			}
			this.drawHead()
		}, effect.duration * 1000)
	}
	update(dt, elapsedTime, tailHitBoxes, tailVanity) {
		if (!this.alive) return
		let hitBox, vanity

		if (Math.random() > 0.98 && this.isPainting && this.isMakingHitboxes) {
			this.updatePaintCooldownFrame = this.frameCount + 1 // skip last hitbox when stoping to paint
			this.isMakingHitboxesCooldown = 10 // Disable it until next frame
		}
		// Next frame
		if (this.updatePaintCooldownFrame === this.frameCount) {
			let holeFactor = .03
			this.isPaintingCooldown = holeFactor * this.radius
			this.isMakingHitboxesCooldown = this.isPaintingCooldown
		}

		// Set begining of tail part
		if (this.isPainting) {
			vanity = new PIXI.Graphics()
			vanity.lineStyle(this.radius * 2, this.tailColor, 1, 0.5)
			vanity.moveTo(this.x, this.y)
		}
		
		// Make icremental movement
		this.turn()
		this.moveForward()

		// Set end of tail part 
		if (this.isPainting) {
			vanity.lineTo(this.x, this.y);
			tailVanity.addChild(vanity);
		}

		// Create hitbox
		if (this.isMakingHitboxes) {
			hitBox = new PIXI.Graphics()
			hitBox.createdAt = elapsedTime
			hitBox.createdBy = this.tailColor
			hitBox.beginFill(0xFF0000)
			const sizeFactor = 0.8
			const rectSize = this.hitBoxSize * sizeFactor
			hitBox.drawRect(-rectSize / 2, -rectSize / 2, rectSize, rectSize)
			hitBox.endFill()
			hitBox.x = this.x
			hitBox.y = this.y
			tailHitBoxes.addChild(hitBox);
		}

		this.isPaintingCooldown = updateCooldown(this.isPaintingCooldown, dt)
		this.isMakingHitboxesCooldown = updateCooldown(this.isMakingHitboxesCooldown, dt)

		this.frameCount++

	}
}