enum ValueMapStep {
	Single,
	Array,
	KeyValue
}

enum ValueMapDirection {
	Right,
	Down,
	Left,
	Up
}

class SheetValues {
	sheet: GoogleAppsScript.Spreadsheet.Sheet;
	data: Object[][];
	formulas: String[][];

	constructor(sheet: GoogleAppsScript.Spreadsheet.Sheet){
		this.sheet = sheet;
		let range = sheet.getRange(1,1, sheet.getMaxRows(), sheet.getMaxColumns());
		this.data = range.getValues();
		this.formulas = range.getFormulas();
		
	}

	find (whatToFind: string): Reader | null {
		
	}

	createReader (row: number, column: number): Reader {
		let newReader = new Reader(row, column, this);
		return newReader
	}

	createReaderAtLabel(): Reader{
		return new Reader(0,0, this)

	}

	createWriterAtLabel(): Writer{
		return new Writer(0,0, this)

	}

	isValidLabel(){

	}

	writeToFile(){

		//Check if row and column number matches
		//if not append appropriate number of row and columns
		//Get range matching the data size
		//Merge formulas with data (forgot how it was done before)
		//Write to File

	}

	addColumn(){

	}

	addRow(){

	}

	accomodate(){

	}

	createBoundObject(objectModel: (string | ValueMapStep | ValueMapDirection)[]){
		let newBound = new BoundObject(this)
		let mapDirection: ValueMapDirection;

		objectModel.forEach(element => {
			switch (typeof(element)){
				case 'string':
					let writer = this.createWriterAtLabel(element)
					if (mapDirection != undefined) {
						writer.setDirection(mapDirection);
					}
					.moveDefault();



			}
			
		});



	}

}

class BoundObject {

	_boundPropertyIndex: {[index:string]: Writer};
	data: SheetValues;
	[x: string | number | symbol]: any;

	constructor(data: SheetValues){
		this.data = data;
		this.boundPropertyIndex = {};

		const boundObjectHandler = {
			get(target: BoundObject, prop, receiver){
				if (prop  in target._boundPropertyIndex){
					return target._boundPropertyIndex[prop].read();
				} else {
					return target[prop];
				}
			},
			set(target: BoundObject, prop, value, receiver): boolean{
				if (prop in target._boundPropertyIndex){
					target._boundPropertyIndex[prop].write(value)
					return true
				} else {
					target[prop] = value;
					return false
				}
			}
		}

		return new Proxy(this, boundObjectHandler);
	}

	addBoundProperty(name: string, propertyWriter: Writer){
		this._boundPropertyIndex[name] = propertyWriter;
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
	}

	read(): string | number | Date | boolean{

		return ''

	}

	readMove(): string | number | Date | boolean {
		let result = this.read();
		this.moveDefault();
		return result
	}

	moveRead(): string | number | Date | boolean {
		this.moveDefault();
		return this.read();
	}

	readRowRight() {

	}

	readColumnDown(){

	}

	readRect(rows: number, columns: number){

	}

	isValid(){

	}

	isEmpty(){

	}

	mark(){

	}

	jumpRowStart(){

	}

	jumpColumnStart(){

	}

	recall() {

	}

	up(){

	}

	down() {

	}

	left() {

	}

	right() {

	}

	goTo() {

	}

	goToNext() {

	}

	makeWriter() {

	}

	clone() {

	}

	makeReader (){

	}

	setDirection(newDirection: ValueMapDirection){
		this.direction = newDirection;
	}

	moveDefault(){
		switch (this.direction) {
			case ValueMapDirection.Down:
				this.down();
			case ValueMapDirection.Right:
				this.right();
			case ValueMapDirection.Left:
				this.left();
			case ValueMapDirection.Up:
				this.up;
		}
	}


	
}

class Writer extends Reader {

	write(newValue: string){
		
	}

	writeMove(newValue: string){
		this.write(newValue);
		this.moveDefault();
		return this
	}

	writeRowRight(){

	}

	writeColumnDown(){

	}

	writeRect(){

	}

}