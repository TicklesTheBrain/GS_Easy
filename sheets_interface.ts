enum ValueMapStep {
	Single,
	Array
}

enum ValueMapDirection {
	Right,
	Down,
	Left,
	Up
}

type ValueMap = {
	labels: string[],
	step?: ValueMapStep,
	direction?: ValueMapDirection,
	distance?: number
	alias?: string[],
}

//TODO:
//Create way to control multiple readers and writer at once;

class SheetValues {
	sheet: GoogleAppsScript.Spreadsheet.Sheet;
	data: (string | number | boolean | Date)[][];
	boundThings: (BoundSingleValue | BoundArray)[];
	formulas: string[][];
	arrayFormulasProtection: boolean;
	volatileCells: boolean[][];

	constructor(sheet: GoogleAppsScript.Spreadsheet.Sheet, arrayFormulasProtection = false){
		this.sheet = sheet;
		this.boundThings = [];
		this.volatileCells = [];
		this.arrayFormulasProtection = arrayFormulasProtection;

		let range = sheet.getRange(1,1, sheet.getMaxRows(), sheet.getMaxColumns());
		this.data = range.getValues();
		this.formulas = range.getFormulas();
		if (arrayFormulasProtection){
			let spreadsheet = sheet.getParent()
			let id = spreadsheet.getId();
			let rangeNotation = sheet.getName() +'!' + range?.getA1Notation();
			let values = Sheets.Spreadsheets?.Values?.get(id, rangeNotation, {valueRenderOption: "FORMULA"}).values as any[][];
			this.volatileCells = this.getVolatileCells(this.data, values);
		}
	}

	getVolatileCells(data: any[][], formulaData: any[][] ): boolean[][]{
		let volatile: boolean[][]= []
		for (let r=0; r<data.length; r++){
			let row: boolean[] = []
			data[r].forEach( (e,i) => {
				if (e==""){row.push(false); return}
				if (formulaData.length-1<r || formulaData[r].length-1<i || formulaData[r][i] != e){
					row.push(true);
				} else {
					row.push(false)
				}
			})
			volatile.push(row);
		}
		return volatile
	}

	find (whatToFind: (string | number | Date), rowOffset: number = 0, columnOffset: number = 0): ([number, number] | undefined) {
		for (let r=0+rowOffset; r<this.data.length; r++){
			let startC = r > 0+rowOffset ? 0 : columnOffset;
			for (let c=startC; c<this.data[r].length; c++){
				if (this.data[r][c] === whatToFind){
					return [r,c]
				}
			}
		}
		return undefined

	}

	readValue(row: number, column: number): (string | number | Date | boolean | undefined) {
		if (row >= this.data.length || row < 0){
			return undefined
		}
		if (column >= this.data[row].length || column < 0){
			return undefined
		}
		return this.data[row][column];
	}

	writeValue(value: any, row: number, column: number){
		if (row < 0 || column  < 0) {
			throw new Error('Writing values into negative indexes');
		}

		if (row >= this.data.length){
			this.addRow(row - this.data.length +1);
		}
		if (column >= this.data[row].length){
			this.addColumn(column - this.data[row].length +1)
		}
		this.data[row][column] = value;
		return this
	}

	createReader (row: number, column: number): Reader {
		let newReader = new Reader(row, column, this);
		return newReader
	}

	createWriter (row: number, column: number): Writer {
		let newWriter = new Writer(row, column, this);
		return newWriter
	}

	createReaderAtLabel(label: string): (Reader | null){
		let pos = this.find(label);
		if (pos) {
			return new Reader(pos[0], pos[1], this)
		}
		return null
	}

	createWriterAtLabel(label: string): (Writer | null){
		let pos = this.find(label);
		if (pos) {
			return new Writer(pos[0], pos[1], this)
		}
		return null
	}

	isValidLabel(label: string, rowOffset: number = 0, columnOffset: number = 0): boolean{
		return !!this.find(label, rowOffset, columnOffset);
	}

	isValid(row: number, column: number): boolean{
		if (row < 0 || row >= this.data.length){
			return false
		}
		if (column < 0 || column >= this.data[row].length){
			return false
		}
		return true
	}

	writeToFile(){

		this.boundThings.forEach(element => { element.record()});

		if (this.arrayFormulasProtection){
			//console.log('this.volatileCells', this.volatileCells)
			for (let r=0; r<this.volatileCells.length; r++){
				this.volatileCells[r].forEach((e,i) => {
					if (e){
						this.data[r][i] = '';
					}
				})
			}
		}

		for (let r=0; r<this.formulas.length; r++){
			for (let c=0; c<this.formulas[r].length; c++){
				if (this.formulas[r][c] != ''){
					this.data[r][c] = this.formulas[r][c];
				}
			}
		}

		let range = this.sheet.getRange(1,1,this.data.length,this.data[0].length);
		range.setValues(this.data);

	}

	addColumn(amount: number = 1){
		this.data.forEach(element => {
			for (let i = 0; i<amount; i++){
				element.push('')
			}
		});
		return this
	}

	addRow(amount: number = 1){
		let columnNo = this.data[0].length;
		for (let i=0; i<amount; i++){
			this.data.push(Array(columnNo).fill(''))
		}
		return this
	}

	createBoundObject(map?: ValueMap){

		//this method is superfluous probably

		//Add ways to bind values manually, not through label search
		let newBound = new BoundObject(this)
		if (map){
			newBound.extendBound(map)
		}
		return newBound
	}

	addBoundThing(newThing: (BoundSingleValue | BoundArray)){
		this.boundThings.push(newThing);
	}

	createBoundObjectArray(labelStartCell: [number, number], direction: ValueMapDirection): BoundObject[]{
		//TODO: Accomodate crazy directions
		let reader = new Reader(labelStartCell[0], labelStartCell[1], this);
		let labels = reader.readRow() as string[];
		//console.log('labels', labels)
		let valueMap: ValueMap = {
			labels: labels,
			direction: direction,
			distance: 1,
		}
		reader.move(direction);
		let boundObjectArray: BoundObject[] = [];

		while (!reader.isEmpty()){
			//console.log('reader state', reader.read())
			boundObjectArray.push(this.createBoundObject(valueMap))
			if (valueMap.distance) { valueMap.distance +=1 ; }
			reader.move(direction);
		}
		return boundObjectArray
	}

}

class BoundSingleValue {

	_data: SheetValues;
	_reference: [number, number];
	v: any;

	record(){
		this._data.writeValue(this.v,  this._reference[0], this._reference[1]);
	}

	constructor(data: SheetValues, reference: [number, number]){

		this._data = data;
		this._reference = reference;
		this.v = data.readValue(reference[0], reference[1]);

		data.addBoundThing(this);

	}
}

class BoundArray {
	_data: SheetValues;
	_firstCellReference: [number, number];
	_direction: ValueMapDirection;
	_v: any[];
	_originalLength: number;

	constructor(data: SheetValues, reference: [number, number], direction: ValueMapDirection = ValueMapDirection.Right){
		this._data = data;
		this._firstCellReference = reference;
		this._direction = direction;
		this._v = data.createReader(reference[0], reference[1]).readArray(direction);
		this._originalLength = this._v.length

		data.addBoundThing(this);
	}
	get v(){
		return this._v;
	}

	set v(newV: any[]){
		if (Array.isArray(newV)){
			this._v = newV;
		} else {
			throw new Error ("Setting bound array to a non-array value");
		}
	}

	record(){
		let writer = this._data.createWriter(this._firstCellReference[0], this._firstCellReference[1])

		if (this.v.length < this._originalLength){
			console.log('clearing old array')
			writer.clearArray(this._direction, this._originalLength);
		}

		writer.writeArray(this.v, this._direction);
	}

}

class BoundObject {

	_boundPropertyIndex: {[index:string]: (BoundSingleValue | BoundArray)};
	_data: SheetValues;
	[x: string | number | symbol]: any;

	constructor(data: SheetValues){
		this._data = data;
		this._boundPropertyIndex = {};

		const boundObjectHandler = {
			get(target: BoundObject, prop, receiver){
				if (prop  in target._boundPropertyIndex){
					return target._boundPropertyIndex[prop].v;
				} else {
					return target[prop];
				}
			},
			set(target: BoundObject, prop, value, receiver): boolean{
				if (prop in target._boundPropertyIndex){
					target._boundPropertyIndex[prop].v = value;
					return true
				} else {
					target[prop] = value;
					return false
				}
			}
		}

		return new Proxy(this, boundObjectHandler);
	}

	addBound(name: string, bound: (BoundSingleValue | BoundArray), alias?: string){
		if (alias != undefined && alias != ""){
			name = alias;
		}
		this._boundPropertyIndex[name] = bound;
	}

	extendBound(model: ValueMap){

		model.labels.forEach(element => {

			let reader = this._data.createReaderAtLabel(element);

			if (reader){
				if (model.direction != undefined){
					reader.setDirection(model.direction)
				}
				reader.moveDefault(model.distance);
				let newBound: (BoundArray | BoundSingleValue)
				switch (model.step){
					case ValueMapStep.Array:
						newBound = new BoundArray(this._data, reader.getPos(), model.direction);
						break;
					default:
						newBound = new BoundSingleValue(this._data, reader.getPos())
						break;
				}
				let alias
				if (model.alias){
					alias = model.alias[model.labels.indexOf(element)]
				}

				this.addBound(element, newBound, alias)
			}
		});
	}
}

type CellRefDictionary = {
	[index: string]: [number, number];
}

class Reader {
	sheetValues: SheetValues;
	row: number;
	column: number;
	mainMark: [number,number];
	otherMarks: CellRefDictionary;
	direction: ValueMapDirection = ValueMapDirection.Down;

	constructor(row: number, column: number, sheetValues: SheetValues){
		this.row = row;
		this.column = column;
		this.sheetValues = sheetValues;
		this.otherMarks = {};
		this.mainMark = [0,0];
	}

	read(direction?: ValueMapDirection, amount?: number): (string | number | Date | boolean | undefined){
		if (direction != undefined){
			this.mark('_tempRead').move(direction, amount);
		}
		let result = this.sheetValues.readValue(this.row, this.column);
		if (direction != undefined){
			this.recall('_tempRead').clearMark('_tempRead');
		}
		return result
	}

	readMove(): (string | number | Date | boolean | undefined) {
		let result = this.read();
		this.moveDefault();
		return result
	}

	moveRead(): (string | number | Date | boolean | undefined) {
		this.moveDefault();
		return this.read();
	}

	move(direction: ValueMapDirection, amount:number = 1){
		switch (direction){
			case ValueMapDirection.Down:
				this.row += amount;
				break;
			case ValueMapDirection.Up:
				this.row -= amount;
				break;
			case ValueMapDirection.Right:
				this.column += amount;
				break;
			case ValueMapDirection.Left:
				this.column -= amount;
				break;
		}
		return this;
	}

	readArray(direction:ValueMapDirection = ValueMapDirection.Right, stopAtEmpty: boolean = true): any[] {
		const arrayMark = '_readArrayTemp';
		let result: any[] = [];
		let prevDirection = this.direction;
		this.mark(arrayMark);
		this.setDirection(direction);
		while ((stopAtEmpty && !this.isEmpty()) || (!stopAtEmpty && this.isValid())) {
			result.push(this.readMove())
		}
		this.recall(arrayMark);
		this.clearMark(arrayMark);
		this.setDirection(prevDirection);
		return result;
	}

	readRow(direction:ValueMapDirection = ValueMapDirection.Right): any[] {
		if (direction != ValueMapDirection.Right && direction != ValueMapDirection.Left){
			throw new Error ('Wrong row read direction')
		}
		return this.readArray(direction)

	}

	getPos(): [number, number]{
		return [this.row, this.column];
	}

	readColumn(direction: ValueMapDirection = ValueMapDirection.Down): any[]{
		if (direction != ValueMapDirection.Down && direction != ValueMapDirection.Up){
			throw new Error ('Wrong column read direction')
		}
		return this.readArray(direction)
	}

	readRect(): any[][]{
		const tempMark = '_readRectTemp';
		let result: any[][] = [];
		this.mark(tempMark);
		while (!this.isEmpty()){
			result.push(this.readRow())
			this.down();
		}
		this.recall(tempMark);
		this.clearMark(tempMark);
		return result;

	}

	isValid(rowOffset: number = 0, columnOffset: number = 0): boolean{
		return this.sheetValues.isValid(this.row + rowOffset, this.column + columnOffset)
	}

	isEmpty(rowOffset: number = 0, columnOffset: number = 0){
		if (!this.isValid(rowOffset, columnOffset) || this.read(rowOffset, columnOffset) === ''){
			return true
		}
		return false
	}

	mark(name?: string){
		if (name){
			this.otherMarks[name] = [this.row, this.column];
		} else {
			this.mainMark = [this.row, this.column];
		}
		return this;
	}

	clearMark(name?: string){
		if (name){
			delete this.otherMarks[name]
		} else {
			this.mainMark = [0,0];
		}
	}

	jumpRowStart(){
		this.column = 0;
		return this;
	}

	jumpColumnStart(){
		this.row = 0;
		return this;
	}

	recall(name?: string) {
		if (name && name in this.otherMarks){
			this.row = this.otherMarks[name][0];
			this.column = this.otherMarks[name][1];
		} else if (!name){
			this.row = this.mainMark[0];
			this.column = this.mainMark[1];
		}
		return this;
	}

	up(amount = 1){
		return this.move(ValueMapDirection.Up, amount);
	}

	down(amount = 1) {
		return this.move(ValueMapDirection.Down, amount);
	}

	left(amount = 1) {
		return this.move(ValueMapDirection.Left, amount);
	}

	right(amount = 1) {
		return this.move(ValueMapDirection.Right, amount);
	}

	goTo(row: number, column: number) {
		this.row = row;
		this.column = column;
		return this
	}

	goToLabel(label: string): boolean{
		let pos = this.sheetValues.find(label)
		if (pos){
			this.goTo(pos[0], pos[1])
			return true
		}
		return false;

	}

	goToNext(label: string): boolean {
		let pos = this.sheetValues.find(label, this.row, this.column)
		if (pos){
			this.goTo(pos[0], pos[1])
			return true
		}
		return false;
	}

	makeWriter(): Writer {
		let newWriter = new Writer(this.row, this.column, this.sheetValues);
		newWriter.mainMark = this.mainMark;
		newWriter.otherMarks = this.otherMarks;
		newWriter.setDirection(this.direction);
		return newWriter;
	}

	clone(): (Writer | Reader) {
		if (this instanceof Writer){
			return this.makeWriter();
		} else {
			return this.makeReader();
		}
	}

	makeReader (): Reader{
		let newReader = new Reader(this.row, this.column, this.sheetValues);
		newReader.mainMark = this.mainMark;
		newReader.otherMarks = this.otherMarks;
		newReader.setDirection(this.direction);
		return newReader
	}

	setDirection(newDirection: ValueMapDirection){
		this.direction = newDirection;
		return this;
	}

	moveDefault(amount = 1){
		return this.move(this.direction, amount);
	}

}

class Writer extends Reader {

	write(newValue: any){
		this.sheetValues.data[this.row][this.column] = newValue;
		return this;
	}

	writeMove(newValue: any){
		this.write(newValue);
		this.moveDefault();
		return this
	}
	moveWrite(newValue: any){
		this.moveDefault();
		this.write(newValue);
		return this;
	}

	writeArray(values: any[], direction: ValueMapDirection){
		let prevDirection = this.direction;
		const arrayMark = '_tempWriteArray';
		this.mark(arrayMark);
		this.setDirection(direction);
		values.forEach(element => {
			this.writeMove(element);
		});
		this.setDirection(prevDirection);
		this.recall(arrayMark)
		this.clearMark(arrayMark)
		return this
	}

	writeRow(values: any[], direction: ValueMapDirection = ValueMapDirection.Right){
		if (direction != ValueMapDirection.Right && direction != ValueMapDirection.Left){
			throw new Error ("Wrong write direction for a row")
		} else {
			return this.writeArray(values, direction);
		}

	}

	writeColumn(values: any[], direction: ValueMapDirection = ValueMapDirection.Down){
		if (direction != ValueMapDirection.Up && direction != ValueMapDirection.Down){
			throw new Error ("Wrong write direction for a column")
		} else {
			return this.writeArray(values, direction);
		}
	}

	writeRect(values: any[][]){
		const rectMark = '_tempWriteRect';
		this.mark(rectMark);
		values.forEach(element => {
			this.writeRow(element);
			this.down();
		});
		this.recall(rectMark);
		this.clearMark(rectMark);
		return this;

	}

	//TODO writeMove, moveWrite, readMove, moveRead might need another look, it is to close to just chaining methods.

	clearArray(direction: ValueMapDirection, distance = 0){
		let prevDirection = this.direction;
		const arrayMark = '_tempArrayClear';
		this.mark(arrayMark);
		this.setDirection(direction);
		let i = 0;
		while(this.isValid() && distance == 0 || this.isValid() && i < distance){
			this.writeMove("");
			i += 1;
		}
		this.setDirection(prevDirection);
		this.recall(arrayMark)
		this.clearMark(arrayMark)
		return this
	}

	clearRow(direction = ValueMapDirection.Right){
		if (direction != ValueMapDirection.Right && direction != ValueMapDirection.Left){
			throw new Error("wrong direction for clear Row");
		}
		return this.clearArray(direction);
	}

	clearColumn(direction = ValueMapDirection.Down){
		if (direction != ValueMapDirection.Down && direction != ValueMapDirection.Up){
			throw new Error("wrong direction for clear Column");
		}
		return this.clearArray(direction);
	}

	add(amount: number){
		let current = this.read();
		if (typeof(current) != "number" || typeof(amount) != "number"){
			throw new Error("can't add non numeric values")
		}
		this.write(current+amount);
		return this;
	}

}