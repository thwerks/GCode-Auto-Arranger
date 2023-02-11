let bedX = 230;         //set bed X dimension
let bedY = 230;         //set bed Y dimension
let gantryX = 32;       //set X gantry height
let carriageX = 7;      //set clearance of the X carriage
let clearanceX = 31;    //set clearance from nozzle to fan shroud in the X axis
let clearanceY = 28;    //set clearance from nozzle to fan shroud in the Y axis
let clearanceS = 2;     //set clearance between skirts (if part maxZ is below carriageX)
let partStartX = 1;     //set begenning point for part alignment X (probably just leave to 5mm)
let partStartY = 1;     //set begenning point for part alignment Y (probably just leave to 5mm)
let partRetraction = 6;             // in between part retraction length in mm
let partRetractionSpeed = 1500;     // retraction speed in mm/min
//---------------------------------------------------------------------------------------------------
const fs = require('fs')
let buf = "";
let line = [];
let part = [];
let gcode = [];
let sys = {
    partVertical: false,
    partHorizontal: false,
    argPosision: undefined,
    makePart: function () {
        part.push({
            posX: 0, posY: 0, partsMaxX: 0, partsMaxY: 0, part: 0, maxZ: 0, maxX: 0, minX: 1024, maxY: 0,
            minY: 1024, sizeX: 0, sizeY: 0, zigZag: false, triTop: false, triSide: false, flat: false
        });
        gcode.push({
            start: [], part: [], partMoved: [], end: [], source: [], tempBed: undefined,
            tempExtruder: undefined, tempBedWait: undefined, tempExtruderWait: undefined
        });
        line.push({ skirtStart: undefined, skirtEnd: false, partStart: undefined, partEnd: undefined, partTotal: 0, })
    }
}
sys.makePart();
let file = process.argv[2].split(".");
console.log("Loading gcode into memory...");
buf = fs.readFileSync(process.argv[2], { encoding: 'utf8', flag: 'r' });
console.log("staging gcode...");
gcode[0].source = buf.toString().split("\n")  //  stage gcode in a line split string array
console.log(color("green", "Analyzing part...", 0));
partAnalyze(0);       // gather data and parse  
partSize(0);          // quantify data
partMoveOrigin(0);      // move part to origin coordinates
checkArgs();          // check arguments - check for additional horizontal or virtical part
partDuplicate();      // create iterations of part
function partAnalyze(num) {
    for (let x = 0; x < gcode[num].source.length; x++) {  // interate every line of gcode data
        if (line[num].skirtEnd == false) {  // find end of the skirt - look for various start conditions
            if (gcode[num].source[x].startsWith('; printing object') == true
                || gcode[num].source[x] == ';TYPE:Perimeter'
                || gcode[num].source[x] == ';TYPE:External perimeter') {
                line[num].skirtEnd = true;
            }
        }
        if (gcode[num].source[x] == ';TYPE:Skirt/Brim'      // find start of skirt
            || gcode[num].source[x] == ';TYPE:Skirt') {
            line[num].skirtStart = x;  
        }
        if (line[num].skirtEnd == false && x > line[num].skirtStart + 2) {    // use skirt to find part length and width
            buf = parseNum(gcode[num].source[x], "X", ' ');   // find part width
            if (buf != undefined && buf > part[num].maxX) part[num].maxX = buf;
            if (buf != undefined && buf < part[num].minX) part[num].minX = buf;
            buf = parseNum(gcode[num].source[x], "Y", ' ');   // find part length
            if (buf != undefined && buf > part[num].maxY) part[num].maxY = buf;
            if (buf != undefined && buf < part[num].minY) part[num].minY = buf;
        }
        if (gcode[num].tempBed == undefined && gcode[num].source[x].startsWith('M140') == true) gcode[num].tempBed = gcode[num].source[x];  // record bed temp
        if (gcode[num].tempExtruder == undefined && gcode[num].source[x].startsWith('M104') == true) gcode[num].tempExtruder = gcode[num].source[x]; // record extruder temp
        if (gcode[num].tempBedWait == undefined && gcode[num].source[x].startsWith('M190') == true) gcode[num].tempBedWait = gcode[num].source[x];
        if (gcode[num].tempExtruderWait == undefined && gcode[num].source[x].startsWith('M109') == true) gcode[num].tempExtruderWait = gcode[num].source[x];
        if (line[num].partEnd == undefined && line[num].partStart != undefined && gcode[num].source[x] == ";TYPE:Custom") line[num].partEnd = x;  // find part end line
        if (gcode[num].source[x].startsWith("G21") == true) line[num].partStart = x;      // find part start line "G21"
        if (line[num].partStart == undefined) (gcode[num].start).push(gcode[num].source[x]);     // copy start gcode to mem
        if (line[num].partStart != undefined && line[num].partEnd == undefined) {
            buf = parseNum(gcode[num].source[x], "Z", ' ');               // parse line if Z move (for purpose of finding z max height)
            if (buf != undefined && buf > part[num].maxZ) part[num].maxZ = buf;  // find max Z in part gcode
            (gcode[num].part).push(gcode[num].source[x]);                                     // copy part gcode to mem
            line[num].partTotal++;
        }
        if (line[num].partEnd != undefined) gcode[num].end.push(gcode[num].source[x])          // copy end gcode to mem 
    }
}
function partSize(num, orientation) {
    if (orientation == "vertical" || orientation == "horizontal") {
        part[num].sizeX = part[num].maxX - part[num].minX;
        part[num].sizeY = part[num].maxY - part[num].minY;
        console.log('Vertical part is: ' + '(x)' + part[num].sizeX.toFixed(2) + 'mm  -  (y)' + part[num].sizeY.toFixed(2) + "mm  -  (z)" + part[num].maxZ + "mm");
        if (part[num].maxZ <= carriageX) {
            console.log(color("green", "Part is lower than carriage", 0));
            part[num].flat = true;
            part[num].partsMaxX = Math.floor(bedX / part[num].sizeX);
            part[num].partsMaxY = Math.floor(bedY / part[num].sizeY);
        } else {
            part[num].partsMaxX = Math.floor((bedX + clearanceX) / (part[num].sizeX + clearanceX));
            part[num].partsMaxY = Math.floor((bedY + clearanceY) / (part[num].sizeY + clearanceY));
        }
        if (orientation == "vertical") console.log("Can fit " + color("green", part[num].partsMaxY, 0) + " vertical parts");
        else console.log("Can fit " + color("green", part[num].partsMaxX, 0) + " horizontal parts");
    } else {
        part[num].sizeX = part[num].maxX - part[num].minX;
        part[num].sizeY = part[num].maxY - part[num].minY;
        console.log('Part is: ' + '(x)' + part[num].sizeX.toFixed(2) + 'mm  -  (y)' + part[num].sizeY.toFixed(2) + "mm  -  (z)" + part[num].maxZ + "mm");
        if (part[num].maxZ <= carriageX) {
            console.log(color("green", "Part is lower than carriage", 0));
            part[num].flat = true;
            part[num].partsMaxX = Math.floor(bedX / part[num].sizeX);
            part[num].partsMaxY = Math.floor(bedY / part[num].sizeY);
        } else {
            part[num].partsMaxX = Math.floor((bedX + clearanceX) / (part[num].sizeX + clearanceX));
            part[num].partsMaxY = Math.floor((bedY + clearanceY) / (part[num].sizeY + clearanceY));
        }
        if (part[num].partsMaxX == 2 && part[num].partsMaxY == 1 || part[num].partsMaxX == 1 && part[num].partsMaxY == 2) {
            if (part[num].maxZ < gantryX) {
                if ((part[num].sizeX * 2) + clearanceX <= bedX) part[num].triTop = true;
                else if ((part[num].sizeY * 2) + clearanceY <= bedY) part[num].triSide = true;
            } else if (part[num].maxZ >= gantryX && (part[num].sizeY * 2) + clearanceY <= bedY) part[num].triSide = true
        } else {
            if (part[num].maxZ >= gantryX) {
                console.log(color("yellow", 'Part is taller than gantry - switching to ZigZag placement', 0));
                part[num].zigZag = true;
                part[num].partsMaxY = Math.floor((bedY + clearanceY) / (part[num].sizeY));
                console.log("Can fit " + color("green", true, 0) + part[num].partsMaxY + " in Zigzag mode" + color("green", false));
            } else {
                console.log("Can fit " + color("green", part[num].partsMaxX, 0) + " in a row");
                console.log("Can have " + color("green", part[num].partsMaxY, 0) + " rows");
            }
        }
        if (part[num].triTop == true || part[num].triSide == true) console.log(color("yellow", "Arranging parts into triangle mode"));
        console.log("Start G-Code is " + gcode[num].start.length + " lines");
        console.log("Part G-Code is " + line[num].partTotal + " lines");
        console.log("End G-Code is " + gcode[num].end.length + " lines");
    }
}
function partMoveOrigin(num) {
    for (let x = 0; x < gcode[num].part.length; x++) {
        (gcode[num].partMoved).push({});
        if (gcode[num].part[x].startsWith('G1 X') == true) {
            buf = parseNum(gcode[num].part[x], "X", ' ')
            gcode[num].partMoved[x].x = (buf - part[num].minX + partStartX).toFixed(3);
            buf = parseNum(gcode[num].part[x], "Y", ' ')
            if (buf != undefined) gcode[num].partMoved[x].y = (buf - part[num].minY + partStartY).toFixed(3);
            buf = parseNum(gcode[num].part[x], "E", ' ')
            if (buf != undefined) gcode[num].partMoved[x].e = buf;
            buf = parseNum(gcode[num].part[x], "F", ' ')
            if (buf != undefined) gcode[num].partMoved[x].f = buf;
        } else gcode[num].partMoved[x].txt = gcode[num].part[x];
    }
}
function partDuplicate() {
    let positionLeft = true;
    buf = "";
    gcode[0].start.forEach((data) => buf += data + "\n");
    if (part[0].zigZag == false) {
        if (part[0].triTop == false && part[0].triSide == false) {
            if (part[0].flat == true) {
                for (let y = 0; y < part[0].partsMaxY; y++) {        // low profile part arrangment
                    for (let x = 0; x < part[0].partsMaxX; x++) {
                        console.log("Creating part at Y(row) " + part[0].posY.toFixed(3) + "  X " + part[0].posX.toFixed(3));
                        partCode(0, part[0].posX, part[0].posY, x, y);
                        part[0].posX += part[0].sizeX + clearanceS;
                    }
                    part[0].posX = 0;
                    part[0].posY += part[0].sizeY + clearanceS;
                }
                if (sys.partVertical == true) {                    // low profile vertical part arrangement
                    part[1].posX = bedX - part[1].sizeX - partStartX;
                    part[1].posY = partStartY;
                    for (let y = 0; y < part[1].partsMaxY; y++) {
                        console.log("Creating vertical part at Y(row) " + part[1].posY.toFixed(3) + "  X " + part[1].posX.toFixed(3));
                        partCode(1, part[1].posX, part[1].posY, 0, y);
                        part[1].posY += part[1].sizeY;
                    }
                }
                if (sys.partHorizontal == true) {                    // low profile horizontal part arrangement
                    part[1].posY = bedY - part[1].sizeY - partStartY;
                    part[1].posX = partStartX;
                    for (let y = 0; y < part[1].partsMaxX; y++) {
                        console.log("Creating horizontal part at Y(row) " + part[1].posY.toFixed(3) + "  X " + part[1].posX.toFixed(3));
                        partCode(1, part[1].posX, part[1].posY, 0, y);
                        part[1].posX += part[1].sizeX;
                    }
                }
            } else {                                            // regular arrangement
                for (let y = 0; y < part[0].partsMaxY; y++) {
                    for (let x = 0; x < part[0].partsMaxX; x++) {
                        console.log("Creating part at Y(row) " + part[0].posY.toFixed(3) + "  X " + part[0].posX.toFixed(3));
                        partCode(0, part[0].posX, part[0].posY, x, y);
                        part[0].posX += part[0].sizeX + clearanceX;
                    }
                    part[0].posX = 0;
                    part[0].posY += part[0].sizeY + clearanceY;
                }
                if (sys.partVertical == true) {                    // vertical part arrangement
                    part[1].posX = bedX - part[1].sizeX - partStartX;
                    part[1].posY = partStartY;
                    for (let y = 0; y < part[1].partsMaxY; y++) {
                        console.log("Creating vertical part at Y(row) " + part[1].posY.toFixed(3) + "  X " + part[1].posX.toFixed(3));
                        partCode(1, part[1].posX, part[1].posY, 0, y);
                        part[1].posY += part[1].sizeY + clearanceY;
                    }
                }
                if (sys.partHorizontal == true) {                    // horizontal part arrangement
                    part[1].posY = bedY - part[1].sizeY - partStartY;
                    part[1].posX = partStartX;
                    for (let y = 0; y < part[1].partsMaxX; y++) {
                        console.log("Creating horizontal part at Y(row) " + part[1].posY.toFixed(3) + "  X " + part[1].posX.toFixed(3));
                        partCode(1, part[1].posX, part[1].posY, 0, y);
                        part[1].posX += part[1].sizeX + clearanceY;
                    }
                }
            }
        } else {                                              // triangle arrangement
            if (part[0].triTop == true) {
                console.log("Creating part in bottom left");
                partCode(0, 0, 0, 0, 0);
                console.log("Creating part in bottom right");
                partCode(0, bedX - part[0].sizeX - (partStartX * 2), 0);
                console.log("Creating part in top center");
                partCode(0, (bedX / 2) - (part[0].sizeX / 2) - partStartX, bedY - part[0].sizeY - (partStartY * 2));
            } else {
                console.log("Creating part in bottom left");
                partCode(0, 0, 0, 0, 0);
                console.log("Creating part in right center");
                partCode(0, bedX - part[0].sizeX - (partStartX * 2), (bedY / 2) - (part[0].sizeY / 2) - partStartY);
                console.log("Creating part in top left");
                partCode(0, 0, bedY - part[0].sizeY - (partStartY * 2));
            }
        }
    } else {                                                // tall zig zag parts
        for (let y = 0; y < part[0].partsMaxY; y++) {
            console.log("Creating part at Y(row) " + part[0].posY.toFixed(3));
            if (positionLeft == true) {
                partCode(0, (bedX / 2) - (part[0].sizeX / 2) - (part[0].sizeX), part[0].posY, 0, y);
                positionLeft = false;
            } else {
                partCode(0, (bedX / 2) - (part[0].sizeX / 2) + (part[0].sizeX), part[0].posY, 0, y);
                positionLeft = true;
            }
            part[0].posY += (clearanceY);
        }
    }
    gcode[0].end.forEach((data) => buf += data + "\n");
    fileWriteOver(buf);
    console.log(color("blue", "Done!", 0));
}
function partCode(num, addX, addY, numX, numY) {
    let partStart = {};
    let partStartFound = false;
    //console.log(buf)
    for (let x = 0; x < gcode[num].partMoved.length; x++) {    // find first x/y cordinate for part[num]. 
        if (gcode[num].partMoved[x].x != undefined) {
            partStart.x = gcode[num].partMoved[x].x;
            if (gcode[num].partMoved[x].y != undefined) partStart.y = gcode[num].partMoved[x].y;
            break;
        }
    }
    for (let x = 0; x < gcode[num].partMoved.length; x++) {
        if (gcode[num].partMoved[x].txt != undefined) {
            buf += gcode[num].partMoved[x].txt;
            if (partStartFound == false && gcode[num].partMoved[x].txt == "M107") {
                if (numX == 0 && numY == 0 && num == 0) {
                } else {
                    buf += "\nG91";
                    buf += "\nG1 Z3";
                    buf += "\nG90";
                    buf += "\nG92 E0";
                    buf += "\nG1 E-" + partRetraction + " F" + partRetractionSpeed;
                    buf += "\nM83";
                    if (sys.partVertical == true) {
                        buf += "\nG1 X" + String((Number(partStart.x) + Number(addX)).toFixed(3));
                        buf += "\nG1 Y" + String((Number(partStart.y) + Number(addY)).toFixed(3));
                    } else {
                        buf += "\nG1 Y" + String((Number(partStart.y) + Number(addY)).toFixed(3));
                        buf += "\nG1 X" + String((Number(partStart.x) + Number(addX)).toFixed(3));
                    }
                    buf += "\n" + gcode[0].tempBed;
                    buf += "\n" + gcode[0].tempExtruder;
                    buf += "\n" + gcode[0].tempBedWait;
                    buf += "\n" + gcode[0].tempExtruderWait;
                    buf += "\nM300 S1000 P200";
                    buf += "\nG1 E12 F" + partRetractionSpeed;
                    //  console.log(buf)
                    partStartFound = true;
                    // console.log("setting jump location")
                }
            }
        }
        else {
            buf += 'G1 X' + String((Number(gcode[num].partMoved[x].x) + addX).toFixed(3));
            if (gcode[num].partMoved[x].y != undefined) buf += ' Y' + String((Number(gcode[num].partMoved[x].y) + addY).toFixed(3));
            if (gcode[num].partMoved[x].e != undefined) buf += ' E' + gcode[num].partMoved[x].e;
            if (gcode[num].partMoved[x].f != undefined) buf += ' F' + String(Number(gcode[num].partMoved[x].f).toFixed(0));
        }
        buf += '\n'
    }
}
function checkArgs() {
    for (let x = 0; x < process.argv.length; x++) {
        if (process.argv[x] == "-v") {
            sys.makePart();
            sys.argPosision = x + 1;
            console.log("Loading vertical part G Code into memory...");
            buf = fs.readFileSync(process.argv[sys.argPosision], { encoding: 'utf8', flag: 'r' });
            gcode[1].source = buf.toString().split("\n")
            console.log(color("green", "Analyzing vertical part...", 0));
            partAnalyze(1);
            partSize(1, "vertical");
            sys.partVertical = true;
            partMoveOrigin(1);
            break;
        }
        if (process.argv[x] == "-h") {
            sys.makePart();
            sys.argPosision = x + 1;
            console.log("Loading horizontal part G Code into memory...");
            buf = fs.readFileSync(process.argv[sys.argPosision], { encoding: 'utf8', flag: 'r' });
            gcode[1].source = buf.toString().split("\n")
            console.log(color("green", "Analyzing horizontal part...", 0));
            partAnalyze(1);
            partSize(1, "horizontal");
            sys.partHorizontal = true;
            partMoveOrigin(1);
            break;
        }
    }
}
function parseNum(data, char, endChar) {  // parser strips alpha prefix and returns integer
    let sort;
    let pos = 0;
    let len = char.length
    let regx = new RegExp(`${char}`, "g")
    obj = [];
    while ((sort = regx.exec(data)) !== null) {
        if (obj[pos] == undefined) obj.push({});
        obj[pos].value = sr();
        function sr() {
            return data.substring(sort.index + len, getEnd());
            function getEnd() {
                for (let x = sort.index + len; x < data.length; x++) {
                    if (data[x] == endChar) return x;
                }
            }
        }
        pos++
    }
    if (obj[0] != undefined && Number(obj[0].value) != NaN) return Number(obj[0].value);
    else return undefined
}
function color(color, input, ...option) {   //  ascii color function for terminal colors
    if (input == undefined) input = '';
    let c;
    let op = ""
    let bold = 'm';
    for (let x = 0; x < option.length; x++) {
        if (option[x] == 0) bold = ';1m';       // bold
        if (option[x] == 1) op = '\x1b[5m';     // blink
        if (option[x] == 2) op = '\u001b[4m';   // underline
    }
    if (color == 'black') c = 0;
    if (color == 'red') c = 1;
    if (color == 'green') c = 2;
    if (color == 'yellow') c = 3;
    if (color == 'blue') c = 4;
    if (color == 'purple') c = 5;
    if (color == 'cyan') c = 6;
    if (color == 'white') c = 7;
    if (input === true) return '\x1b[3' + c + bold;     // begin color without end
    if (input === false) return '\x1b[37;m';            // end color
    let buf = op + '\x1b[3' + c + bold + input + '\x1b[37;m';
    return buf;
}
function fileWriteOver(data) {
    try {
        fs.unlinkSync(file[0] + " (full bed)." + file[1]);
        console.log(color("yellow", "File alredy exists, overwriting data", 0));
    } catch (error) {
        console.log(color("green", "Creating New File - Writing Data", 0));
    }
    fs.appendFileSync(file[0] + " (full bed)." + file[1], data + "\n",);
}
