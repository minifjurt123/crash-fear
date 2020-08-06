class Game extends PIXI.Application {
	players = []
	pointsToWin = 10
	paused = false
	roundActive = false
	elapsedTime = 0
	borderWidth = 5
	countdown = 0
	portalBorders = false
	portalBorderAnimFactor = 0
	debugMode = true
	titleStyle = new PIXI.TextStyle({
		fontSize: 100,
		fontWeight: "bold",
		fill: "white",
		// stroke: "black",
		// strokeThickness: 2
	})
	startScreen = document.getElementById('startScreen')
	startMenu = {
		activePlayer: null,
		pressKeyNode: 'Press desired key'
	}
	playerList = document.getElementById('playerList')
	startButton = document.getElementById('startButton')
	get isRunning() {
		return this.roundActive && !this.paused
	}
	get alivePlayers() {
		return this.players.filter(p => p.alive)
	}
	get height () {
		return this.renderer.view.height
	}
	get width () {
		return this.renderer.view.width
	}
	get innerHeight() {
		return this.height - this.borderWidth * 2
	}
	get innerWidth() {
		return this.width - this.borderWidth * 2
	}
	get activatedPlayers() {
		return players.filter(p => p.controls && p.controls.left && p.controls.right)
	}
	constructor() {
		super({
			width: 800,
			height: 600,
			// backgroundColor: 0x1099bb,
			backgroundColor: 0x111111,
			resolution: window.devicePixelRatio || 1,
			antialias: true,
		})
		document.body.appendChild(this.view);

		// Maximize
		this.renderer.view.style.position = "absolute";
		this.renderer.view.style.display = "block";
		this.renderer.autoDensity = true;
		window.addEventListener('resize', () => {
			this.renderer.resize(window.innerWidth, window.innerHeight);
		})
		this.renderer.resize(window.innerWidth, window.innerHeight);

		// Tail containers
		this.tailHitBoxes = new PIXI.Container()
		this.stage.addChild(this.tailHitBoxes)
		this.tailVanity = new PIXI.Container()
		this.stage.addChild(this.tailVanity)

		// Create borders graphics (get's drawn in loop)
		this.borders = new PIXI.Graphics()
		this.stage.addChild(this.borders)
		this.drawBorders()

		// Powerup container
		this.powerUps = new PIXI.Container()
		this.stage.addChild(this.powerUps)
		this.powerUpSpawnCooldown = 0

		this.createPauseIndicator()
		this.createMessageContainer()
		this.createStartScreen()
		
		// Action key functionality
		this.actionKey = keyboard(" ")
		this.actionKey.press = () => {
			if (this.roundActive) {
				this.paused = !this.paused
				this.pauseIndicator.visible = this.paused
			} else {
				this.newRound()
			}
		}

		this.debugKey = keyboard("§")
		this.debugKey.press = this.toggleDebugMode.bind(this)
		this.toggleDebugMode()

		// Start game loop
		this.ticker.add(this.loop.bind(this))

		// Stat the first round
		// this.newRound()

	}
	toggleDebugMode() {
		this.debugMode = !this.debugMode
		this.tailHitBoxes.visible = this.debugMode
		this.tailVanity.alpha = this.debugMode ? 0.5 : 1
	}
	setControlListener(event) {
		let aP = this.startMenu.activePlayer
		console.log(aP)
		if (aP) {
			if (!aP.controls.left) {
				aP.controls.left = event.key
				aP.elements.selectLeft.innerText = event.key
				aP.elements.selectRight.innerText = this.startMenu.pressKeyNode
			} else if (!aP.controls.right) {
				aP.controls.right = event.key
				// No longer needs to be active
				aP.elements.selectRight.innerText = event.key
				this.startMenu.activePlayer = null
			}
		}
	}
	createStartScreen() {
		this.startButton.addEventListener("click", () => {
			this.createPlayers()
			this.newRound()
			this.startScreen.style.display = "none"

		});
		this.boundedEventListener = this.setControlListener.bind(this)
		document.addEventListener('keydown', this.boundedEventListener)
		players.forEach(p => {
			p.controls = {}
			p.elements = {}
			let row = document.createElement('tr')
			row.className = 'player-row'
			row.style.color = '#' + p.color.toString(16)
			let name = document.createElement('td')
			name.textContent = p.name
			let selectLeft = document.createElement('td')
			let selectRight = document.createElement('td')
			p.elements.selectLeft = selectLeft
			p.elements.selectRight = selectRight
			row.append(name)
			row.append(selectLeft)
			row.append(selectRight)
			row.style.opacity = 0.5;
			row.addEventListener('click', () => {
				if (!this.startMenu.activePlayer) {
					this.startMenu.activePlayer = p
				} else {
					return
				}
				// If not currently setting controls sel
				if ((!p.controls.left && !p.controls.right) || (p.controls.left && p.controls.right)) {
					this.startMenu.activePlayer = p
					p.controls = {}
					p.elements.selectLeft.innerText = this.startMenu.pressKeyNode
					p.elements.selectRight.innerText = null
				}
				
			})
			this.playerList.append(row)
		})

	}
	createMessageContainer() {
		this.message = new PIXI.Container()
		this.message.addChild(new PIXI.Text(null, this.titleStyle))
		this.stage.addChild(this.message)

	}
	showMessage(message) {
		this.message.getChildAt(0).text = message
		this.message.x = this.renderer.view.width / 2 - this.message.width / 2
		this.message.y = this.renderer.view.height / 2 - this.message.height
		this.message.visible = true
	}
	hideMessage() {
		this.message.visible = false
	}
	createPauseIndicator() {
		// Pause Indicator
		let text = "II Paused"
		this.pauseIndicator = new PIXI.Text(text);
		this.stage.addChild(this.pauseIndicator);
		const offset = 10
		this.pauseIndicator.x = offset;
		this.pauseIndicator.y = offset;
		this.pauseIndicator.visible = false;
	}
	drawBorders() {
		this.borders.clear()
		// this.borders.beginFill(this.portalBorders ? 0xf1e05a : 0x333333) // yellow or grey
		this.borders.beginFill(0xf1e05a)
		this.borders.drawRect(0, 0, this.width, this.height)
		this.borders.endFill()
		this.borders.beginHole()
		this.borders.drawRect(
			this.borderWidth,
			this.borderWidth,
			this.innerWidth,
			this.innerHeight
		)
		this.borders.endHole()

		if (this.portalBorders) {
			const { alpha, factor} = animateAlpha(this.borders.alpha, this.portalBorderAnimFactor)
			this.borders.alpha = alpha
			this.portalBorderAnimFactor = factor
		}
	}
	async newRound() {
		if (this.countdown !== 0) return // Disable starting a new round when countdown is active
		this.powerUpSpawnCooldown = 0 // Spawn a powerup directly on round start
		clearInterval(this.portalBordersTimer) // clear portal border timer if it exists
		// Reset all players
		this.players.forEach(p => {
			p.alive = true
			p.effects = []
			p.randomizePosition(this.renderer.view.width, this.renderer.view.height)
			p.drawHead()
		})
		
		// Remove entities
		this.clearTails()
		this.clearPowerUps()

		// Start the countdown for the next round
		await this.startCountdown(3, 300)
		this.roundActive = true
	}
	clearTails() {
		deleteObjects(this.tailHitBoxes.children.concat(this.tailVanity.children))
	}
	clearPowerUps() {
		deleteObjects(this.powerUps.children)
	}
	createPlayers() {
		document.removeEventListener('keydown', this.boundedEventListener)

		// Create players
		console.log(this.activatedPlayers)
		let activatedNames = this.activatedPlayers.map(aP => aP.name)
		this.players = players
			.filter(p => activatedNames.includes(p.name))
			.map(p => {
				return new Player(p)
			})
		// Add the players to the stage
		this.players.forEach(p => {
			this.stage.addChild(p)
		})
	}
	createPowerUp() {
		if (this.powerUpSpawnCooldown > 0) return
		this.powerUpSpawnCooldown = getRandomNumberBetween(5, 5)
		const index = Math.round(Math.random() * (powerUpDefinitions.length - 1))
		const {name} = powerUpDefinitions[index]
		const powerUp = new PowerUp(name)
		powerUp.randomizePosition(this.renderer.view.width, this.renderer.view.height)
		this.powerUps.addChild(powerUp)
	}
	async startCountdown(startingNumber, msPerNumber = 1000) {
		return new Promise((res, rej) => {
			this.countdown = startingNumber
			const countSecond = () => {
				this.showMessage(this.countdown)
				setTimeout(() => {
					this.countdown--
					if (this.countdown === 0) {
						res()
						this.hideMessage()
					} else {
						countSecond()
					}
				}, msPerNumber)
			}
			countSecond()

		})
	}
	loop(speedFactor) {
		// speedFactor is a factor showing if the game is going slower or faster than expected - speedFactor = 1 is aimed speed
		if (!this.isRunning) return
		const deltaTime = speedFactor / 60 // seconds
		this.elapsedTime += deltaTime

		this.drawBorders()
		// Handle players
		this.players.forEach(p => {
			// Update players
			p.update(deltaTime, this.elapsedTime, this.tailHitBoxes, this.tailVanity)
			let canTp = this.portalBorders || p.canTeleportThroughBorders // Global or on player
			let offset = this.borderWidth + p.radius
			if (p.x - p.width / 2 < this.borderWidth) { // left
				canTp ? p.x = this.width - offset : this.killPlayer(p)
			} else if (p.x + p.width / 2 > this.width - this.borderWidth) { // right
				canTp ? p.x =  + offset : this.killPlayer(p)
			} else if (p.y - p.height / 2 < this.borderWidth) { // up
				canTp ? p.y = this.height - offset : this.killPlayer(p)
			} else if (p.y + p.height / 2 > this.height - this.borderWidth) { // down
				canTp ? p.y = offset : this.killPlayer(p)
			}
			// Check if colliding with any tail
			this.tailHitBoxes.children.forEach(hitBox => {
				let oldEnough = this.elapsedTime - hitBox.createdAt > (.5 / p.velocity)
				let isSelf = hitBox.createdBy === p.tailColor
				let collides = p.collidesWith(hitBox)
				if (collides && (oldEnough || !isSelf)) {
					this.killPlayer(p)
				}
			})

			// Check if colliding with a powerUp
			this.powerUps.children.forEach((powerUp, i) => {
				let collides = p.collidesWith(powerUp)
				if (collides) {
					this.powerUps.removeChildAt(i)
					if (powerUp.actsOn === 'enemies') {
						this.players
							.filter(p2 => p2.name !== p.name) // All but colliding player
							.forEach(p2 => p2.addEffect(Object.assign({}, powerUp.playerEffect)))
					} else if (powerUp.actsOn === 'self') {
						p.addEffect(powerUp.playerEffect)
					} else if (powerUp.actsOn === 'global') {
						switch (powerUp.name) {
							case 'clear':
								this.clearTails()
								break;
							case 'portalBorders':
								this.portalBorders = true
								this.portalBordersTimer = setTimeout(() => {
									this.portalBorders = false
									this.borders.alpha = 1
								}, powerUp.duration * 1000)
								break;
						}
					}
				}
				// powerUp
			})
		})
		// Handle powerups
		this.powerUpSpawnCooldown -= deltaTime
		this.createPowerUp()
	}
	killPlayer(player) {
		player.die()
		this.alivePlayers.forEach(p => {
			p.score++
		})
		if (this.players.length > 1) {
			if (this.players.filter(p => p.alive).length <= 1) {
				this.endRound()
			}
		} else {
			if (!this.players.some(p => p.alive)) {
				this.endRound()
			}
		}
	}
	endRound() {
		this.winner = this.players.find(p => p.alive)
		this.showMessage(this.winner ? `${this.winner.name} is the winner!` : 'Everyone died')
		this.roundActive = false
	}
}