# GCode-Auto-Arranger

This utility has two main goals; firstly to automatically arrange parts on the bed and secondly to ensure brims and skirts are printed at the time of subsequent parts. Contrastingly, Prusa Slicer prints the brims for all parts first, then individually prints the parts.

This program wont help people who want to have different parts on one bed (although I could if anyone is interested) but for those who are printing multiple instances of the same part, this utility is for you.

This utility will take a single part GCode file and replicate it. It's still work in progress but for the most part it should work fine. The program analyzes your part and determines how many can fit on your bed and then replicates the GCode, keeping the start and end GCode as normal, only replicating the part GCode. The X gantry height is taken into consideration and the program employs a different strategy if a potential collision is possible.

How to Use:

Enable "Label Objects" in PrusaSlicer in Print Settings / Output Options
Use PrusaSlicer and put a single part on the bed and export GCode using control+g
Run the app in the command line as such (node /path/to/gcode.js /path/to/your/part.gcode) or Windows (node c:\gcode.js c:\path\to\your\part.gcode)
A new file is created with the same name and inside same directory, appended with "new"
Use PrusaSlicer GCode viewer to confirm results are satisfactory
What this program does:

It separates the beginning, actual part and ending GCode
It determines the maximum amount of parts that will fit on your bed size (which you specify)
Part GCode is ripped out and modified, so you'r free to use any brim, skirt settings you want for an individual part.
Modifies GCode to perform an Y/X move before Z moves when moving to print next part
Reheats and waits for bed/extruder start temps each time new part begins
It arranges the print order, starting in front left of the bed, moving to the right and back to the next row
It uses carriage dimensions (which you specify) to know how much space to put between each part
It use X gantry height (which you specify) to switch to a different strategy to avoid X gantry collisions
If parts are large rectangles, Triangle Mode activates and the program attempts to arrange 3 parts in a bottom left, top center, bottom right arrangement or top left, center right, bottom left arrangement depending on rectangle orientation.
You can specify the X, Y starting offset. Default is X5mm Y5mm
This is a work in progress so if anyone has an issue, send me a picture of what its doing and your GCode so I can try to fix it.
Open to suggestions

All you need to do is download NodeJS for Windows or Linux.
It was written in NodeJS 14 and possibly might not work in NodeJS 10 but I'm not completely sure
You need to edit the first 5 lines with dimensions that match your printer, its currently set for an Ender 3
