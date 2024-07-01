function newSlotPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var newX = maxArea.x + Math.round(maxArea.width / numberXslots * x);
    var newY = maxArea.y + Math.round(maxArea.height / numberYslots * y);

    // Width and height is calculated by finding where the window should end and subtracting where it should start
    var clientWidth = Math.round(maxArea.width / numberXslots * (x + xSlotToFill)) - (newX - maxArea.x);
    var clientHeight = Math.round(maxArea.height / numberYslots * (y + ySlotToFill)) - (newY - maxArea.y);

    return [newX, newY, clientWidth, clientHeight]
}

function reposition(client, newX, newY, w, h) {
    client.frameGeometry = {
        x: newX,
        y: newY,
        width: w,
        height: h
    }
}

function move(workspace, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
    var client = workspace.activeWindow;
    if (client.moveable && client.resizeable) {
        client.setMaximize(false,false);
        arr = newSlotPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill);
        var newX = arr[0],
            newY = arr[1],
            w = arr[2],
            h = arr[3];
        reposition(client, newX, newY, w, h)
    }
}

function center(workspace) {
    var client = workspace.activeWindow;
    if (client.moveable) {
        var maxArea = workspace.clientArea(KWin.MaximizeArea, client);
        var newX = Math.round(maxArea.x + ((maxArea.width - client.width) / 2));
        var newY = Math.round(maxArea.y + ((maxArea.height - client.height) / 2));
        reposition(client, newX, newY, client.width, client.height)
    }
}

function ensureWithinVisibleArea(client, new_w, new_h, old_w, old_h, old_x, old_y) {
    var new_x, new_y;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);
    var ratio = new_w / new_h;

    var diff_x = old_w - new_w,
        diff_y = old_h - new_h;

    // Calculate a new x and y that will keep the position
    // of the window centered with respect to its previous
    // position
    new_x = old_x + Math.round(diff_x / 2);
    new_y = old_y + Math.round(diff_y / 2);

    // Ensure the newly calculate position is within the boundaries
    // of the visible desktop area
    if (new_y + new_h > maxArea.bottom) {
        new_y = new_y - ((new_y + new_h) - maxArea.bottom);
    }
    if (new_x + new_w > maxArea.right) {
        new_x = new_x - ((new_x + new_w) - maxArea.right);
    }

    // Also ensure that new_x and new_y is never less than 0
    new_x = new_x < 0 ? 0 : new_x;
    new_y = new_y < 0 ? 0 : new_y;

    return {"x": new_x, "y": new_y, "w": new_w, "h": new_h};
}

function calcShrink(client, decStepPx, minSizePx) {
    var geom = client.frameGeometry;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var ratio = geom.width / geom.height;
    var new_w, new_h;
    var new_xywh = {"x": geom.x, "y": geom.y, "w": geom.width, "h": geom.height};

    // Ensure the minSizePx is smaller than maxArea width/height
    minSizePx = minSizePx > maxArea.width ? maxArea.width : minSizePx;
    minSizePx = minSizePx > maxArea.height ? maxArea.height : minSizePx;

    if (client.moveable && client.resizeable) {
        if (ratio >= 1) {
            // Width >= Height
            new_w = geom.width - decStepPx;
            new_w = new_w < minSizePx ? minSizePx : new_w;
            new_h = Math.round(new_w / ratio);

            if (new_h > maxArea.height) {
                new_h = maxArea.height
                new_w = Math.round(new_h * ratio);
            }
        } else {
            // Height > Width
            new_h = geom.height - decStepPx;
            new_h = new_h < minSizePx ? minSizePx : new_h;
            new_w = Math.round(new_h * ratio);

            if (new_w > maxArea.width) {
                new_w = maxArea.width
                new_h = Math.round(new_w / ratio);
            }
        }

        new_xywh = ensureWithinVisibleArea(client, new_w, new_h, geom.width, geom.height, geom.x, geom.y)
    }

    return {"x": new_xywh.x, "y": new_xywh.y, "w": new_xywh.w, "h": new_xywh.h};
}

function calcGrow(client, incStepPx) {
    var geom = client.frameGeometry;
    var maxArea = workspace.clientArea(KWin.MaximizeArea, client);

    var ratio = geom.width / geom.height;
    var new_w, new_h;
    var new_xywh = {"x": geom.x, "y": geom.y, "w": geom.width, "h": geom.height};

    if (client.moveable && client.resizeable) {
        if (ratio >= 1) {
            // Width >= Height
            new_w = geom.width + incStepPx;
            new_w = new_w > maxArea.width ? maxArea.width : new_w;
            new_h = Math.round(new_w / ratio);

            if (new_h > maxArea.height) {
                new_h = maxArea.height
                new_w = Math.round(new_h * ratio);
            }
        } else {
            // Height > Width
            new_h = geom.height + incStepPx;
            new_h = new_h > maxArea.height ? maxArea.height : new_h;
            new_w = Math.round(new_h * ratio);

            if (new_w > maxArea.width) {
                new_w = maxArea.width
                new_h = Math.round(new_w / ratio);
            }
        }

        new_xywh = ensureWithinVisibleArea(client, new_w, new_h, geom.width, geom.height, geom.x, geom.y)
    }

    return {"x": new_xywh.x, "y": new_xywh.y, "w": new_xywh.w, "h": new_xywh.h};
}

function resize(workspace, action, incStepPx, minSizePx) {
    var client = workspace.activeWindow;

    if (client.moveable && client.resizeable) {
        var newGeom;

        if (action == "shrink") {
            newGeom =  calcShrink(client, incStepPx, minSizePx);
        } else if (action == "grow") {
            newGeom = calcGrow(client, incStepPx);
        } else {
            print("Please choose an action between 'shrink' and 'grow'");
            return;
        }

        // print(client.resourceName, JSON.stringify(newGeom));

        reposition(client, newGeom.x, newGeom.y, newGeom.w, newGeom.h);
    }
}

function moveWithFixedSize(workspace, moveDirection, movePx) {
    var client = workspace.activeWindow;
    var geom = client.frameGeometry;
    var x = geom.x,
        y = geom.y;
    if (client.moveable) {
        if (moveDirection == "left") {
            x = geom.x - movePx;
        } else if (moveDirection == "right") {
            x = geom.x + movePx;
        } else if (moveDirection == "up") {
            y = geom.y - movePx;
        } else if (moveDirection == "down") {
            y = geom.y + movePx;
        } else {
            print("Please choose a move direction between 'left', 'right', 'up' and 'down'");
            return;
        }
        new_xy = ensureWithinVisibleArea(client, geom.width, geom.height, geom.width, geom.height, x, y);
        reposition(client, new_xy.x, new_xy.y, geom.width, geom.height);
    }
}

// function isInPosition(workspace, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill) {
//     var client = workspace.activeWindow;
//     if (client.moveable) {
//         arr = getPosition(workspace, client, numberXslots, numberYslots, x, y, xSlotToFill, ySlotToFill);
//         var newX = arr[0],
//             newY = arr[1],
//             w = arr[2],
//             h = arr[3];
//         return (client.x == newX && client.y == newY && client.width == w && client.height == h);
//     }
//     return false;
// }

registerShortcut("MoveWindowToCenter", "UltrawideWindowsAndThirds: Center Window", "ctrl+meta+k", function () {
    move(workspace, 6, 6 , 1, 1, 4, 4)
}); 

registerShortcut("ThirdLeft", "UltrawideWindowsAndThirds: 1/3 Left", "ctrl+meta+u", function () {
    move(workspace, 3, 1, 0, 0, 1, 1)
}); 

registerShortcut("ThirdMiddle", "UltrawideWindowsAndThirds: 1/3 Middle", "ctrl+meta+i", function () {
    move(workspace, 3, 1, 1, 0, 1, 1)
}); 

registerShortcut("ThirdRight", "UltrawideWindowsAndThirds: 1/3 Right", "ctrl+meta+o", function () {
    move(workspace, 3, 1, 2, 0, 1, 1)
}); 

registerShortcut("TwoThirdsLeft", "UltrawideWindowsAndThirds: 2/3 Left", "ctrl+meta+j", function () {
    move(workspace, 3, 1, 0, 0, 2, 1)
}); 

registerShortcut("TwoThirdsRight", "UltrawideWindowsAndThirds: 2/3 Right", "ctrl+meta+l", function () {
    move(workspace, 3, 1, 1, 0, 2, 1)
}); 

registerShortcut("TwoThirdsRight", "UltrawideWindowsAndThirds: 2/3 Right", "ctrl+meta+l", function () {
    move(workspace, 3, 1, 1, 0, 2, 1)
}); 

registerShortcut("ThirdTopVert", "UltrawideWindowsAndThirds: 1/3 Top (Vertical", "ctrl+meta+y", function () {
    move(workspace, 1, 3, 0, 0, 1, 1)
}); 

registerShortcut("ThirdMiddleVert", "UltrawideWindowsAndThirds: 1/3 Middle (Vertical)", "ctrl+meta+h", function () {
    move(workspace, 1, 3, 0, 1, 1, 1)
}); 

registerShortcut("ThirdBottomVert", "UltrawideWindowsAndThirds: 1/3 Bottom (Vertical)", "ctrl+meta+n", function () {
    move(workspace, 1, 3, 0, 2, 1, 1)
}); 