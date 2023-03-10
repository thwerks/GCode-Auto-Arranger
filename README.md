# GCode Auto Arranger

This utility has two main goals; firstly to automatically arrange parts on the bed and secondly to ensure brims and skirts are printed at the time of subsequent parts. Contrastingly, Prusa Slicer prints the brims for all parts first, then individually prints the parts.

This program wont help people who want to have different parts on one bed (although I could if anyone is interested) but for those who are printing multiple instances of the same part, this utility is for you.

This utility will take a single part GCode file and replicate it. It's still a work in progress though.

The program analyzes your part and determines how many can fit on your bed and then replicates the GCode, keeping the start and end GCode as normal, only replicating the part GCode. The X gantry height is taken into consideration and the program employs a different strategy if a potential collision is possible.


## What this program does:

* It separates the beginning, actual part and ending GCode
* It determines the maximum amount of parts that will fit on your bed size (which you specify)
* Part GCode is ripped out and modified, so you'r free to use any brim, skirt settings you want for an individual part
* Modifies GCode to perform an Y/X move before Z moves when moving to print next part
* Reheats and waits for bed/extruder start temps each time new part begins (if you choose)
* It arranges the print order, starting in front left of the bed, moving to the right and back to the next row
* It uses carriage dimensions (which you specify) to know how much space to put between each part
* It use X gantry height (which you specify) to switch to a different strategy to avoid X gantry collisions
* If parts are large rectangles, Triangle Mode activates and the program attempts to arrange 3 parts in a bottom left, top center, bottom right arrangement or top left, center right, bottom left arrangement depending on rectangle orientation
* You can specify the X, Y starting offset. Default is X5mm Y5mm


## How to Use:

* Enable "Label Objects" in PrusaSlicer in Print Settings / Output Options
* Use PrusaSlicer and put a single part on the bed and export GCode using control+g
* Run the app in the command line as such (node /path/to/gcode.js /path/to/your/part.gcode) or Windows (node c:\gcode.js c:\path\to\your\part.gcode)
* A new file is created with the same name and inside same directory, appended with "full bed"
* Use PrusaSlicer GCode viewer to confirm results are satisfactory

### Additional Part Feature
* You can specify one addional part to be printed virtically or horizontally by using -h or -v followed by path to gcode file
* The purpose for that is to fit one more part on the bed that would otherwise not fit had it not been in an opposing orientation
* **Example:** node /path/to/gcode.js /path/to/your/part.gcode -v /path/to/your/part-virtical.gcode

# Execution:
* All you need to do is download NodeJS for Windows or Linux.
* It was written in NodeJS 19 and possibly might not work in NodeJS 10 but I'm not completely sure
* **You need to edit the first sectio of variables with dimensions that match your printer**, its currently set for an Ender 3



**This is a work in progress so if anyone has a question, create an "issue" here in github and send your GCode and 3mf project file so I can try to fix it. Im also open to suggestions**
