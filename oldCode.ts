/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array: any[]) {
	for (var i = array.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

function boardReveal(){
	let boardValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Board') as GoogleAppsScript.Spreadsheet.Sheet);
	let player1Values = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player1') as GoogleAppsScript.Spreadsheet.Sheet, true);
	let player2Values = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player2') as GoogleAppsScript.Spreadsheet.Sheet, true);

	let board = boardValues.createBoundObject({labels: ["message"], direction: ValueMapDirection.Right})

	//Check if board in correct step
	let stepWriter = boardValues.createWriterAtLabel("Step")?.right();
	if (stepWriter?.read() == "Reveal"){
		board.message = "Can't do reveal, board already in reveal step";
		boardValues.writeToFile();
		return
	}

	//then check if both players locked in
	board.player1 = boardValues.createBoundObject({labels: ["P1 Locked in?"], direction: ValueMapDirection.Right, alias: ["locked"]})
	board.player2 = boardValues.createBoundObject({labels: ["P2 Locked in?"], direction: ValueMapDirection.Right, alias: ["locked"]})

	if (board.player1.locked == "NO" || board.player2.locked == "NO"){
		board.message = "Can't do reveal, not all players locked";
		boardValues.writeToFile();
		return;
	}
	board.message = "Card reveal done, assign outcomes and additional points."

	//Set step to reveal
	stepWriter?.write("Reveal");

	//Read cards from player sheet
	let p1Cards = player1Values.createReaderAtLabel("Tableau")?.right().readArray(ValueMapDirection.Right,false) as any[];
	let p2Cards = player2Values.createReaderAtLabel("Tableau")?.right().readArray(ValueMapDirection.Right,false) as any[];

	//Add them to the board
	boardValues.createWriterAtLabel("P1 Cards")?.right().writeRow(p1Cards);
	boardValues.createWriterAtLabel("P2 Cards")?.right().writeRow(p2Cards);

	//Reset outcomes for the tableau
	let outcomeWriter = boardValues.createWriterAtLabel("Outcome")?.right().write("Standoff");
	while (outcomeWriter?.goToNext("Outcome")){
		outcomeWriter.right().write("Standoff")
	}

	//Reset additional scoring
	let additionalWriter = boardValues.createWriterAtLabel("Card Score")?.right().write("");
	while (additionalWriter?.goToNext("Card Score")){
		additionalWriter.right().write("")
	}

	boardValues.writeToFile();

}

function test(){
   let player1values = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player1') as GoogleAppsScript.Spreadsheet.Sheet, true);
   let cardValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CardList') as GoogleAppsScript.Spreadsheet.Sheet);
	drawCards(player1values, cardValues, 1)
}

function boardNewRound(newGame = false){

	console.log("loading sheets")
	let boardValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Board') as GoogleAppsScript.Spreadsheet.Sheet);
	let player1Values = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player1') as GoogleAppsScript.Spreadsheet.Sheet, true);
	let player2Values = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Player2') as GoogleAppsScript.Spreadsheet.Sheet, true);
	let rulesValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Rules') as GoogleAppsScript.Spreadsheet.Sheet);
	let cardsValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CardList') as GoogleAppsScript.Spreadsheet.Sheet);

	let board = boardValues.createBoundObject({labels: ["message"], direction: ValueMapDirection.Right});

	//Load Rules Values
	let slotsPerRound = rulesValues.createReaderAtLabel("Max Slot")?.down().readColumn() as number[];
	let energyPerRound = rulesValues.createReaderAtLabel("Max Energy")?.down().readColumn() as number[];
	let drawsPerRound = rulesValues.createReaderAtLabel("Card Draw")?.down().readColumn() as number[];
	let maxRounds = slotsPerRound.length;

	//Check if board in correct step
	let stepWriter = boardValues.createWriterAtLabel("Step")?.right();
	if (stepWriter?.read() == "Setup"){
		board.message = "Can't start new round, board still in setup step";
		boardValues.writeToFile();
		return
	}

	//Add score from previous round
	console.log("resetting score")
	let p1ScoreWriter = boardValues.createWriterAtLabel("P1 Score")?.right().add(boardValues.createReaderAtLabel('P1 Points This Round')?.right().read() as number);
	let p2ScoreWriter = boardValues.createWriterAtLabel("P2 Score")?.right().add(boardValues.createReaderAtLabel('P2 Points This Round')?.right().read() as number);

	if (newGame){
		p1ScoreWriter?.write(0);
		p2ScoreWriter?.write(0);
	}
	
	//Change Round number
	console.log("changing round number")
	let round = 0;
	board.extendBound({labels: ["Round"], direction: ValueMapDirection.Right});
	if (newGame){
		board.Round = round;
	}
	if (typeof(board.Round) != "number"){
		board.message = "Can't start a new round, this was the last one. Final scores shown."
		boardValues.writeToFile();
		return
	} else if (board.Round == maxRounds-1){
		board.Round = maxRounds.toString() + " (FINAL ROUND)";
		round = maxRounds;
		board.message = "Final round started, go to player sheets";
	} else {
		board.Round += 1;
		round = board.Round;
		board.message = `${newGame? "New game! ": ""} Round ${round} started, go to player sheets for setup.`;
	}

	//Set step to setup
	stepWriter?.write("Setup");

	//reset player lock value
	player1Values.createWriterAtLabel("Locked")?.right().write("NO");
	player2Values.createWriterAtLabel("Locked")?.right().write("NO");

	//change initiative
	console.log("changing initiative")
	let p1InitWriter = boardValues.createWriterAtLabel("Player1")?.right();
	let p2InitWriter = boardValues.createWriterAtLabel("Player2")?.right();

	let p1Init = p1InitWriter?.read();
	let p2Init = p2InitWriter?.read();

	if (newGame){
		let r = Math.random();
		if (r>=0.5){
			p1Init = "INITIATIVE";
			p2Init = "";
		} else {
			p1Init = "";
			p2Init = "INITIATIVE";
		}
	}

	if (p1Init == ""){
		p1InitWriter?.write("INITIATIVE")
	} else {
		p1InitWriter?.write("")
	}
	if (p2Init == ""){
		p2InitWriter?.write("INITIATIVE")
	} else {
		p2InitWriter?.write("")
	}

	
	//Card draw for both players
	console.log("drawing cards")
	let cardsToDraw = drawsPerRound[round-1];
	if (newGame){
		player1Values.createWriterAtLabel('cardsDrawn')?.right().clearRow();
		player2Values.createWriterAtLabel('cardsDrawn')?.right().clearRow();
	}
	drawCards(player1Values, cardsValues, cardsToDraw);
	drawCards(player2Values, cardsValues, cardsToDraw);
	
	
	//Max energy adjust for both players
	console.log("setting max energy")
	let maxEnergy = energyPerRound[round-1];
	player1Values.createWriterAtLabel("🔷Max")?.right().write(maxEnergy);
	player2Values.createWriterAtLabel("🔷Max")?.right().write(maxEnergy);
	
	//Set correct locked slots for players
	console.log("setting correct slots")
	let unlockedSlots = slotsPerRound[round-1];
	function setSlotLockState(player: SheetValues){
		let writer = player.createWriterAtLabel('Tableau')?.up().right();
		let slotNo = 1
		while (writer?.isValid()){
			if (!writer.isEmpty()){
				if (slotNo <= unlockedSlots){
					writer.write(slotNo);
					slotNo += 1;
				} else {
					writer.write("Locked")
				}
			}
			writer.right()
		}
	}
	
	setSlotLockState(player1Values);
	setSlotLockState(player2Values);
	
	//Create message objects
	let player1 = player1Values.createBoundObject({labels: ["message"], direction: ValueMapDirection.Right});
	let player2 = player2Values.createBoundObject({labels: ["message"], direction: ValueMapDirection.Right});
	player1.message = `${newGame? "[NEW GAME] " : ""} Round ${round} started, setup step. ${cardsToDraw} cards drawn, energy at ${maxEnergy}.`
	player2.message = `${newGame? "[NEW GAME] " : ""} Round ${round} started, setup step. ${cardsToDraw} cards drawn, energy at ${maxEnergy}.`

	//Additional new game cleanup
	console.log("about to do new game cleanup")
	if (newGame){

		//Reset outcomes for the tableau
		let outcomeWriter = boardValues.createWriterAtLabel("Outcome")?.right().write("Standoff");
		while (outcomeWriter?.goToNext("Outcome")){
			outcomeWriter.right().write("Standoff")
		}

		//Reset additional scoring
		let additionalWriter = boardValues.createWriterAtLabel("Card Score")?.right().write("");
		while (additionalWriter?.goToNext("Card Score")){
			additionalWriter.right().write("")
		}

		//Clear card leftovers
		boardValues.createWriterAtLabel("P1 Cards")?.right().clearRow();
		boardValues.createWriterAtLabel("P2 Cards")?.right().clearRow();
		player1Values.createWriterAtLabel("cardsDiscared")?.right().clearRow();
		player1Values.createWriterAtLabel("cardsInUsePrevious")?.right().clearRow();
		player2Values.createWriterAtLabel("cardsDiscared")?.right().clearRow();
		player2Values.createWriterAtLabel("cardsInUsePrevious")?.right().clearRow();

		function clearTableau(player: SheetValues){
			let writer = player.createWriterAtLabel("Tableau")?.up().right();
			while (writer?.isValid()){
				if (!writer.isEmpty()){
					writer.down().write("None").up()
				}
				writer.right();
			}
		}

		clearTableau(player1Values);
		clearTableau(player2Values);

	}

	//Write everything to spreadsheet
	console.log("writing to board")
	boardValues.writeToFile();
	console.log("writing to player1")
	player1Values.writeToFile();
	console.log("writing to player2")
	player2Values.writeToFile();

}

function playerEndSetup(){

	const maxRemoved = 1;
	const maxAdded = 2;

	let playerValues = new SheetValues(SpreadsheetApp.getActiveSheet(), true)
	let player = playerValues.createBoundObject({labels: ["message", "Locked"], direction: ValueMapDirection.Right});

	//Validate not already locked
	if (player.Locked == "YES"){
		player.message = "Can't end setup, you've already locked your cards in."
		playerValues.writeToFile();
		return
	}

	//Validate below max energy
	player.extendBound({labels: ["🔷Max", "🔷Used"], direction: ValueMapDirection.Right, alias: ["energyMax", "energyUsed"]})
	if (player.energyUsed > player.energyMax){
		player.message = "Can't end setup, over the energy limit.";
		playerValues.writeToFile();
		return
	}

	//Validate cards used
	player.extendBound({labels: ["cardsInUsePrevious", "cardsDiscarded"], step: ValueMapStep.Array, direction: ValueMapDirection.Right});
	let currentCards = playerValues.createReaderAtLabel("Tableau")?.right().readArray(ValueMapDirection.Right, false).filter( element => {return element != "" && element != "None"}) as string[];
	let cardsRemovedCount = player.cardsInUsePrevious.reduce((c, card) => {return c + card in currentCards? 1 : 0},0);
	let cardsAddedCount = currentCards.reduce((c, card)=> {return c + card in player.cardsInUsePrevious? 0 : 1}, 0);
	if (cardsRemovedCount > maxRemoved){
		player.message = "You've removed too many cards this round";
		resetTableauToPrevious();
		playerValues.writeToFile();
		return
	}

	if (cardsAddedCount > maxAdded){
		player.message = "You've added too many cards this round";
		resetTableauToPrevious();
		playerValues.writeToFile();
		return
	}

	function resetTableauToPrevious(){
		//TODO: Is this needed?
   }

	//Record cards used in slots
	player.cardsInUsePrevious = currentCards;

	//Lock player
	player.Locked = "YES";

	player.message = "Card tableau Locked";
	playerValues.writeToFile();

}

function boardNewGame(){
	boardNewRound(true);

}

function playerDrawCard(){
	let playerValues = new SheetValues(SpreadsheetApp.getActiveSheet(), true)
	let cardsValues = new SheetValues(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CardList') as GoogleAppsScript.Spreadsheet.Sheet);


	drawCards(playerValues, cardsValues, 1);

	playerValues.writeToFile();

}

function drawCards(playerSheetValues: SheetValues, cardsSheetValues: SheetValues, amount: number){

	const maxHandSize = 7

	let allCardNames = cardsSheetValues.createReaderAtLabel('Name')?.down().readColumn();
	let player = playerSheetValues.createBoundObject({labels: ["cardsDrawn", "isInHand"], step: ValueMapStep.Array, direction: ValueMapDirection.Right});
	let availableCards = allCardNames?.filter(e => !(player.cardsDrawn.includes(e)));
	console.log('all cards', allCardNames, 'player cards', player.cardsDrawn, 'available', availableCards);
	
	let cardsInHand = player.isInHand.filter(e => e).length //This is not working correctly on new game.
	// console.log('card states ', player.isInHand);
	// console.log('card draw attempt', maxHandSize, 'cards in hand', cardsInHand, 'amount', amount);
	amount = Math.min(amount, maxHandSize-cardsInHand);
	shuffleArray(availableCards as string[]);
	for (let i=0; i<amount; i++){
		player.cardsDrawn.push(availableCards?.pop())
	}
}