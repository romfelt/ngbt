/*global $, window*/
$.fn.jtris = function(options) {
	'use strict';

	var self = $(this);
	var id = self.attr('id');

	var defaults = {
		blockSize: 9,
		field: { border: 1, width: 12, height: 19 },
		keys: { 
			left: 37, // keycode arrow left
			right: 39, // keycode arrow right
			rotate: 38, // keycode arrow up
			drop: 40, // keycode arrow down
			pause: 80 // keycode p
		},
		events: { // object ids register onclick event handlers for 
			left: null, 
			right: null, 
			rotate: null, 
			drop: null,
			pause: null
		},
		callbacks: {
			updateScore: function(s) { console.log("no callback updateScore()")}
		}
	};

	var config = $.extend(true, {}, defaults, options);

	var game = { 
		timer: null,
		level: 0,
		drop: false,
		toggles: 0,
		ignoreKeys: true,
		fieldData: [], 
		scorePerLine: [0, 40, 100, 300, 1200], // score per line multiplied with (level + 1)
		speedLevels: [53, 49, 45, 41, 37, 33, 28, 22, 17, 11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3],
		figure: { x: 5, y: 0, r: 0, n: 0 },
		nextFigure: 0,
		statistics: { score: 0, lines: 0, figures: 0, level: 0 }
	};

	const figures = [
		{ offset: 0, blocks: [[0x11, 0x12, 0x22, 0x23], [0x11, 0x21, 0x02, 0x12], [0x11, 0x12, 0x22, 0x23], [0x11, 0x21, 0x02, 0x12]] }, // S
		{ offset: 0, blocks: [[0x21, 0x12, 0x22, 0x13], [0x11, 0x21, 0x22, 0x32], [0x21, 0x12, 0x22, 0x13], [0x11, 0x21, 0x22, 0x32]] }, // Z
		{ offset: 1, blocks: [[0x21, 0x12, 0x22, 0x32], [0x21, 0x22, 0x32, 0x23], [0x12, 0x22, 0x32, 0x23], [0x21, 0x12, 0x22, 0x23]] }, // T
		{ offset: 0, blocks: [[0x21, 0x22, 0x23, 0x13], [0x11, 0x12, 0x22, 0x32], [0x21, 0x31, 0x22, 0x23], [0x12, 0x22, 0x32, 0x33]] }, // J
		{ offset: 0, blocks: [[0x12, 0x22, 0x13, 0x23], [0x12, 0x22, 0x13, 0x23], [0x12, 0x22, 0x13, 0x23], [0x12, 0x22, 0x13, 0x23]] }, // O
		{ offset: 0, blocks: [[0x21, 0x22, 0x23, 0x33], [0x12, 0x22, 0x32, 0x13], [0x11, 0x21, 0x22, 0x23], [0x31, 0x12, 0x22, 0x32]] }, // L
		{ offset: 0, blocks: [[0x20, 0x21, 0x22, 0x23], [0x01, 0x11, 0x21, 0x31], [0x20, 0x21, 0x22, 0x23], [0x01, 0x11, 0x21, 0x31]] }  // I
	];

	// Returns a random integer between min (included) and max (included)
	function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// debug function to output game field data
	function printField() {
		for (var j = 0; j < (config.field.height - config.field.border); j++) {
			var s = (j < 10 ? ' ' + j : j) + ': ';
			for (var i = config.field.border; i < (config.field.width - config.field.border); i++) {
				s += game.fieldData[i][j].value;
			}
			console.log(s);
		}
	}

	// update statistics and make game decisions such as calculate score and level
	function updateStatistics(type, n) {
		if (type == 'figure') {
			game.statistics.figures += 1;
		}
		else if (type == 'drop') {
			game.statistics.score += 1; 
			return; // don't update score while dropping
		}
		else if (type == 'line') {
			game.statistics.lines += n;
			game.statistics.score += game.scorePerLine[n] * (game.statistics.level + 1);
			game.statistics.level = Math.floor(game.statistics.lines / 10);
			if (game.statistics.level > 20) {
				game.statistics.level = 20;
			}
		}

		if (typeof config.callbacks.updateScore === 'function') {
			config.callbacks.updateScore(game.statistics);
		}
	}

	// TODO make a callback
	function drawBlock(x, y, c) {
		var b = game.fieldData[x][y].block;
		b.removeClass(function (index, css) {
			// remove all classes starting with 'jtris-block-'
			return (css.match(/(^|\s)jtris-block-\S+/g) || []).join(' ');
		});
		b.addClass('jtris-block-' + c);
		b.show();
	}

	// TODO make a callback
	function initializeGameField() {
		game.fieldData = [];
		for (var i = 0; i < config.field.width; i++) {
			var row = [];
			for (var j = 0; j < config.field.height; j++) {
				var b = $('<div />')
					.addClass('jtris-block')
					.css({ width: config.blockSize, height: config.blockSize, left: config.blockSize * i, top: config.blockSize * j});

				self.append(b);
				row.push({ value: 9, block: b });
			}
			game.fieldData.push(row);
		}

		for (var i = config.field.border; i < (config.field.width - config.field.border); i++) {
			for (var j = 0; j < (config.field.height - config.field.border); j++) {
				game.fieldData[i][j].value = 8;
			}
		}
	}

	function drawGameField() {
		for (var i = 0; i < config.field.width; i++) {
			for (var j = 0; j < config.field.height; j++) {
				drawBlock(i, j, game.fieldData[i][j].value);
			}
		}
	}

	function drawFigure(color) {
		var c = game.figure.n;
		if (typeof(color) !== 'undefined') {
			c = color;
		}
		for (var i = 0; i < 4; i++) {
			var b = figures[game.figure.n].blocks[game.figure.r][i],
				x = game.figure.x + ((b >> 4) & 0xf),
				y = game.figure.y + (b & 0xf);
			if (y >= 0) {
				drawBlock(x, y, c);
			}
		}
	}

	function checkFigure(f) {
		for (var i = 0; i < 4; i++) {
			var b = figures[f.n].blocks[f.r][i],
				x = f.x + ((b >> 4) & 0xf),
				y = f.y + (b & 0xf);
			if (x < 0 || y < 0 || x >= config.field.width || y >= config.field.height || game.fieldData[x][y].value != 8) {
				return false; // block in figure collides with game field block (including border) or is outside field
			}
		}
		return true;
	}

	// delta should be any new x, y or r values.
	function moveFigure(delta) {
		var f = $.extend(true, {}, game.figure, delta);
		if (checkFigure(f)) {
			drawFigure(8); // erase current position
			game.figure = f; // store new position
			drawFigure(); // show new position
			return true;
		}
		return false;
	}

	function storeFigure() {
		updateStatistics('figure');
		for (var i = 0; i < 4; i++) {
			var b = figures[game.figure.n].blocks[game.figure.r][i],
				x = game.figure.x + ((b >> 4) & 0xf),
				y = game.figure.y + (b & 0xf);
			game.fieldData[x][y].value = game.figure.n;
		}
	}

	function startFigure() {
		clearInterval(game.timer);
		game.drop = false;
		game.figure.x = Math.floor((config.field.width - 2 * config.field.border) / 2) - 2;
		game.figure.y = 0;
		game.figure.r = 0;
		game.figure.n = game.nextFigure;
		game.nextFigure = getRandomInt(0, 6);
		if (moveFigure() === false) {
			console.log("GAME OVER!");
		}
		else {
			game.ignoreKeys = false;
			startTimer(game.speedLevels[game.statistics.level] * 14);
		}
	}

	function startTimer(period) {
		clearInterval(game.timer);
		if (typeof(period) !== 'undefined') {
			game.timerPeriod = period;
		}
		game.timer = setInterval(moveDown, game.timerPeriod);
	}

	function checkSingleLine(y) {
		for (var i = config.field.border; i < (config.field.width - config.field.border); ++i) {
			if (game.fieldData[i][y].value == 8)
				return false;
		}
		return true; // complete line
	}

	function markLine(y) {
		for (var i = config.field.border; i < (config.field.width - config.field.border); ++i) {
			drawBlock(i, y, 10);
		}
	}

	function moveLinesDown(y) {
		for (var i = config.field.border; i < (config.field.width - config.field.border); ++i) {
			for (var j = y; j > 0; --j) {
				game.fieldData[i][j].value = game.fieldData[i][j - 1].value;
			}
		}
	}

	function checkLines() {
		var l = Array();
		for (var i = game.figure.y; i < (config.field.height - config.field.border) && i < (game.figure.y + 4); ++i) {
			if (checkSingleLine(i)) {
				console.log("complete line at y = " + i);
				l.push(i);
			}
		}

		for (var i = 0; i < l.length; ++i) {
			markLine(l[i]);
			moveLinesDown(l[i]);
		}

		if (l.length > 0) {
			updateStatistics('line', l.length);
		}

		return l.length > 0;
	}

	function blinkLines(skipToggle) {
		if (skipToggle !== true) {
			$('.jtris-block-10').toggle();
		}

		if (game.toggles > 0) {
			game.toggles--;
			setTimeout(blinkLines, 150);
			return;
		}

		setTimeout(function () {
			drawGameField();
			startFigure();
		}, 	250);
	}

	function moveDown() {		
		if (moveFigure({ 'y' : (game.figure.y + 1) }) === false) {
			game.ignoreKeys = true;
			clearInterval(game.timer);
			storeFigure();
			if (checkLines()) {
				game.toggles  = 7;
				blinkLines(true);
			}
			else {
				startFigure();
			}
		}
		else if (game.drop) {
			updateStatistics('drop');
		}
	}

	function doAction(action) {
		if (game.ignoreKeys)
			return;

		switch (action) {
			case 'right': 
				moveFigure({ 'x' : (game.figure.x + 1) });
				break;
			case 'left':
				moveFigure({ 'x' : (game.figure.x - 1) });
				break;
			case 'rotate':
				var r = game.figure.r < 3 ? game.figure.r + 1 : 0;
				moveFigure({ 'r' : r });
				break;
			case 'drop':
				game.drop = true;
				startTimer(30); // set new faster drop speed
				moveDown();
				break;
			case 'pause':
				break;
		}
	}

	function startNewGame() {
		game.nextFigure = getRandomInt(0, 6);
		initializeGameField();
		drawGameField();
		startFigure();
	}

	// register key event handlers
	$(window).keydown(function(e) {
		var keycode = e.which;

		switch (keycode) {
			case config.keys.right: doAction('right'); break;
			case config.keys.left: doAction('left'); break;
			case config.keys.rotate: doAction('rotate'); break;
			case config.keys.drop: doAction('drop'); break;
			case config.keys.pause: doAction('pause'); break;
		}

		e.stopPropagation();
		e.preventDefault();
	});

	// register event handlers
	$('#' + config.events.left).on('click', function() { doAction('left'); });
	$('#' + config.events.right).on('click', function() { doAction('right'); });
	$('#' + config.events.rotate).on('click', function() { doAction('rotate'); });
	$('#' + config.events.drop).on('click', function() { doAction('drop'); });

	startNewGame();

	return this;
};
