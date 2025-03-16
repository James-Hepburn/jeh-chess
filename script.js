var board = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"], 
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"], 
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

var pieces = {
  "wp": "images/pieces/white/pawn_front.png",
  "wn": "images/pieces/white/knight_front.png",
  "wb": "images/pieces/white/bishop_front.png",
  "wr": "images/pieces/white/rook_front.png",
  "wq": "images/pieces/white/queen_front.png",
  "wk": "images/pieces/white/king_front.png",
  "bp": "images/pieces/black/pawn_front.png",
  "bn": "images/pieces/black/knight_front.png",
  "bb": "images/pieces/black/bishop_front.png",
  "br": "images/pieces/black/rook_front.png",
  "bq": "images/pieces/black/queen_front.png",
  "bk": "images/pieces/black/king_front.png"
};

var position_history = {};

var white_rook_moved = {left: false, right: false};
var black_rook_moved = {left: false, right: false};

var selected_piece = null;
var last_move = null;
var white_turn = true;
var white_king_moved = false;
var black_king_moved = false;
var halfmove_clock = 0;
var gameStarted = false;

document.getElementById ("turn_indicator").style.display = "none";

function preloadImages() {
    Object.values(pieces).forEach((src) => {
        const img = new Image();
        img.src = src;
    });
}
preloadImages();

generate_board();
disable_board();

function generate_board() {
  var chess_board = document.getElementById("chess_board");
  chess_board.innerHTML = "";

  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var square = document.createElement("div");
      square.classList.add("square", (i + j) % 2 === 0 ? "light" : "dark");
      square.dataset.row = i;
      square.dataset.col = j;

      if (board[i][j] != null) {
        var img = document.createElement("img");
        img.src = pieces[board[i][j]];
        img.classList.add("piece");

        if (gameStarted) {
          make_draggable(img, i, j);
        }
        square.appendChild(img);
      }

      if (gameStarted) {
        make_droppable(square, i, j);
      }

      chess_board.append(square);
    }
  }
}

function save_board_state () {
  var state = JSON.stringify (board);
  position_history [state] = (position_history [state] || 0) + 1;
}

function is_threefold_repetition () {
  var state = JSON.stringify (board);
  return position_history [state] >= 3;
}

async function move_piece (old_row, old_col, row, col) {
  var piece = board [old_row][old_col];
  var captured_piece = board [row][col];

  if (piece === "wk" && old_row === 7 && old_col === 4) {
    if (col === 6 && board [7][7] === "wr") {
      board [7][5] = "wr";
      board [7][7] = null;
    } else if (col === 2 && board [7][0] === "wr") { 
      board [7][3] = "wr";
      board [7][0] = null;
    }
  }

  if (piece === "bk" && old_row === 0 && old_col === 4) {
    if (col === 6 && board [0][7] === "br") { 
      board [0][5] = "br";
      board [0][7] = null;
    } else if (col === 2 && board [0][0] === "br") { 
      board [0][3] = "br";
      board [0][0] = null;
    }
  }

  if (piece.includes ("p") && (row === 0 || row === 7)) {
    promote_pawn (row, col, piece[0]);
  }

  if (piece.includes ("p") && last_move && last_move.piece.includes ("p") && last_move.row === old_row && last_move.old_row === old_row + (piece[0] === "w" ? -2 : 2) && last_move.col === col) {
    board [old_row][col] = null;
  }

  board [row][col] = piece;
  board [old_row][old_col] = null;
  last_move = {piece, old_row, old_col, row, col};

  if (piece === "wk") white_king_moved = true;
  if (piece === "bk") black_king_moved = true;
  if (piece === "wr" && old_row === 7 && old_col === 0) white_rook_moved.left = true;
  if (piece === "wr" && old_row === 7 && old_col === 7) white_rook_moved.right = true;
  if (piece === "br" && old_row === 0 && old_col === 0) black_rook_moved.left = true;
  if (piece === "br" && old_row === 0 && old_col === 7) black_rook_moved.right = true;

  save_board_state ();

  setTimeout (async () => {
    generate_board();
    
    if (is_in_checkmate ()) {
      alert ("Checkmate! " + (white_turn ? "Black" : "White") + " wins!");
      return;
    } else if (is_stalemate ()) {
      alert ("Stalemate! The game is a draw.");
      return;
    } else if (is_threefold_repetition ()) {
      alert ("Threefold repetition! The game is a draw.");
      return;
    } else if (halfmove_clock >= 100) {
      alert ("50-move rule! The game is a draw.");
      return;
    } else if (is_insufficient_material ()) {
      alert ("Insufficient material! The game is a draw.");
      return;
    }
    white_turn = !white_turn;
    document.getElementById ("turn_indicator").innerText = white_turn ? "White's Turn" : "Black's Turn";

    await sendMove();
    await fetchGameState();
    
    setTimeout (generate_board, 50);
  }, 100);
}

function promote_pawn (row, col, color) {
  var promotionContainer = document.createElement ("div");
  promotionContainer.classList.add ("promotion-container");
  promotionContainer.style.position = "absolute";

  var boardRect = document.getElementById ("chess_board").getBoundingClientRect();
  promotionContainer.style.top = (boardRect.top + row * 80) + "px"; 
  promotionContainer.style.left = (boardRect.left + col * 80) + "px";

  ["q", "r", "b", "n"].forEach (piece => {
    var pieceImg = document.createElement ("img");
    pieceImg.src = pieces [color + piece];
    pieceImg.classList.add ("promotion-piece");
    pieceImg.onclick = function () {
      board [row][col] = color + piece;
      document.body.removeChild (promotionContainer);
      enable_board ();
      generate_board ();
    };
    promotionContainer.appendChild (pieceImg);
  });

  disable_board ();
  document.body.appendChild (promotionContainer);

  setTimeout (() => {
    if (document.body.contains (promotionContainer)) {
      board [row][col] = color + "q"; 
      document.body.removeChild (promotionContainer);
      enable_board ();
      generate_board ();
    }
  }, 20000);
}

function disable_board () {
  document.querySelectorAll (".piece").forEach (piece => piece.draggable = false);
}

function enable_board () {
  document.querySelectorAll (".piece").forEach (piece => piece.draggable = true);
}

function is_valid_pawn_move (old_row, old_col, row, col) {
  var piece = board [old_row][old_col];

  if (piece [0] === "w") {
    if (col === old_col && board [row][col] === null) {
      if (row === old_row - 1) return true;
      if (old_row === 6 && row === 4 && board [5][col] === null) return true;
    } else if (Math.abs (col - old_col) === 1 && row === old_row - 1) {
      if (board [row][col] && board [row][col][0] === "b") return true;

      if (last_move && last_move.piece === "bp" && last_move.row === old_row && last_move.old_row === old_row - 2 && last_move.col === col) {
        board [old_row][col] = null;
        return true;
      }
    }
  }

  if (piece [0] === "b") {
    if (col === old_col && board [row][col] === null) {
      if (row === old_row + 1) return true;
      if (old_row === 1 && row === 3 && board [2][col] === null) return true;
    } else if (Math.abs (col - old_col) === 1 && row === old_row + 1) {
      if (board [row][col] && board [row][col][0] === "w") return true;

      if (last_move && last_move.piece === "wp" && last_move.row === old_row && last_move.old_row === old_row + 2 && last_move.col === col) {
        board [old_row][col] = null;
        return true;
      }
    }
  }

  return false;
}

function is_stalemate () {
  if (is_in_check ()) return false;

  var color = white_turn ? "w" : "b";

  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      if (board [i][j] && board [i][j][0] === color) {
        for (var r = 0; r < 8; r++) {
          for (var c = 0; c < 8; c++) {
            if (is_valid_move_with_check_checking (i, j, r, c, board [i][j])) {
              return false; 
            }
          }
        }
      }
    }
  }

  return is_insufficient_material () ? true : true;
}

function is_insufficient_material () {
  var pieces = {"w": [], "b": []};
  var bishops = {"w": [], "b": []};

  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var piece = board [i][j];
      if (piece) {
        pieces [piece[0]].push (piece);
        if (piece.includes ("b")) bishops [piece[0]].push ((i + j) % 2);
      }
    }
  }

  if (pieces ["w"].length === 1 && pieces ["b"].length === 1) return true;

  if (pieces ["w"].length === 2 && (pieces ["w"].includes ("wb") || pieces ["w"].includes ("wn")) && pieces ["b"].length === 1) return true;
  if (pieces ["b"].length === 2 && (pieces ["b"].includes ("bb") || pieces ["b"].includes ("bn")) && pieces ["w"].length === 1) return true;

  if (pieces ["w"].length === 2 && pieces ["b"].length === 2) {
    if (pieces ["w"].includes ("wb") && pieces ["b"].includes ("bb")) {
      if (bishops ["w"][0] === bishops ["b"][0]) return true;
    }
  }

  if (pieces ["w"].length === 2 && pieces ["w"].includes ("wn") && pieces ["b"].length === 1) return true;
  if (pieces ["b"].length === 2 && pieces ["b"].includes ("bn") && pieces ["w"].length === 1) return true;

  return false;
}

function is_valid_knight_move (old_row, old_col, row, col) {
  return (Math.abs (old_col - col) == 1 && Math.abs (old_row - row) == 2) || (Math.abs (old_col - col) == 2 && Math.abs (old_row - row) == 1);
}

function is_valid_rook_move (old_row, old_col, row, col) {
  return is_clear_path (old_row, old_col, row, col) && (old_row == row || old_col == col);
}

function is_valid_bishop_move (old_row, old_col, row, col) {
  return is_clear_path (old_row, old_col, row, col) && Math.abs (old_row - row) == Math.abs (old_col - col);
}

function is_valid_queen_move (old_row, old_col, row, col) {
  return is_valid_bishop_move (old_row, old_col, row, col) || is_valid_rook_move (old_row, old_col, row, col);
}

function is_valid_king_move (old_row, old_col, row, col) {
  var piece = board [old_row][old_col];

  if (Math.abs (old_row - row) <= 1 && Math.abs (old_col - col) <= 1) {
    return !would_be_in_check (row, col);
  }

  if (is_in_check ()) return false;

  if (piece === "wk" && old_row === 7 && old_col === 4 && !white_king_moved) {
    if (col === 6 && board [7][7] === "wr" && !white_rook_moved.right && board [7][5] === null && board [7][6] === null) {
      if (!would_be_in_check (7, 4) && !would_be_in_check (7, 5) && !would_be_in_check (7, 6)) {
        return true;
      }
    }
    if (col === 2 && board [7][0] === "wr" && !white_rook_moved.left && board [7][1] === null && board [7][2] === null && board [7][3] === null) {
      if (!would_be_in_check (7, 4) && !would_be_in_check (7, 3) && !would_be_in_check (7, 2)) {
        return true;
      }
    }
  }

  if (piece === "bk" && old_row === 0 && old_col === 4 && !black_king_moved) {
    if (col === 6 && board [0][7] === "br" && !black_rook_moved.right && board [0][5] === null && board [0][6] === null) {
      if (!would_be_in_check (0, 6)) {
        return true;
      }
    }
    if (col === 2 && board [0][0] === "br" && !black_rook_moved.left && board [0][1] === null && board [0][2] === null && board [0][3] === null) {
      if (!would_be_in_check (0, 2)) {
        return true;
      }
    }
  }
  return false;
}

function is_clear_path (old_row, old_col, row, col) {
  var dr = old_row < row ? 1 : old_row > row ? -1 : 0;
  var dc = old_col < col ? 1 : old_col > col ? -1 : 0;

  var r = old_row + dr;
  var c = old_col + dc;

  while (r !== row || c !== col) {
    if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;
    if (board[r][c] !== null) return false;

    r += dr;
    c += dc;
  }

  return true;
}

function would_be_in_check (row, col) {
  var king_pos = find_king (white_turn ? "w" : "b");
  var old_row = king_pos.row;
  var old_col = king_pos.col;

  var temp = board [row][col];
  board [row][col] = board [old_row][old_col];
  board [old_row][old_col] = null;

  var still_in_check = is_in_check ();

  board [old_row][old_col] = board [row][col];
  board [row][col] = temp;

  return still_in_check;
}

function is_in_check () {
  var king_pos = find_king (white_turn ? "w" : "b"); 
  var king_row = king_pos.row;
  var king_col = king_pos.col;

  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var piece = board [i][j];

      if (piece && piece[0] !== (white_turn ? "w" : "b")) {
        if (is_valid_attack_move (i, j, king_row, king_col, piece)) {
          return true; 
        }
      }
    }
  }

  return false; 
}

function find_king (color) {
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      if (board [i][j] === color + "k") {
        return {row: i, col: j};
      }
    }
  }
  
  return {row: -1, col: -1};
}

function is_valid_attack_move (old_row, old_col, row, col, piece) {
  if (piece.includes ("p")) return is_valid_pawn_attack (old_row, old_col, row, col);
  if (piece.includes ("n")) return is_valid_knight_move (old_row, old_col, row, col);
  if (piece.includes ("r")) return is_valid_rook_move (old_row, old_col, row, col);
  if (piece.includes ("b")) return is_valid_bishop_move (old_row, old_col, row, col);
  if (piece.includes ("q")) return is_valid_queen_move (old_row, old_col, row, col);
  if (piece.includes ("k")) return Math.abs (old_row - row) <= 1 && Math.abs (old_col - col) <= 1;
  return false;
}

function is_valid_pawn_attack (old_row, old_col, row, col) {
  var piece = board [old_row][old_col];
  
  if (piece [0] === "w") return row === old_row - 1 && Math.abs (col - old_col) === 1; 
  if (piece [0] === "b") return row === old_row + 1 && Math.abs (col - old_col) === 1; 
  
  return false;
}

function is_in_checkmate () {
  if (!is_in_check ()) return false;

  var color = white_turn ? "w" : "b";

  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      if (board [i][j] && board [i][j][0] === color) {
        for (var r = 0; r < 8; r++) {
          for (var c = 0; c < 8; c++) {
            if (is_valid_move_with_check_checking (i, j, r, c, board [i][j])) {
              return false; 
            }
          }
        }
      }
    }
  }

  return true;
}

function is_valid_move (old_row, old_col, row, col, piece) {
  if (piece.includes ("p")) return is_valid_pawn_move (old_row, old_col, row, col);
  if (piece.includes ("n")) return is_valid_knight_move (old_row, old_col, row, col);
  if (piece.includes ("r")) return is_valid_rook_move (old_row, old_col, row, col);
  if (piece.includes ("q")) return is_valid_queen_move (old_row, old_col, row, col);
  if (piece.includes ("k")) return is_valid_king_move (old_row, old_col, row, col);
  if (piece.includes ("b")) return is_valid_bishop_move (old_row, old_col, row, col);

  return false;
}

function is_valid_move_with_check_checking (old_row, old_col, row, col, piece) {
  if (!is_valid_move (old_row, old_col, row, col, piece)) return false;

  var temp = board [row][col];
  board [row][col] = piece;
  board [old_row][old_col] = null;

  var stillInCheck = is_in_check ();

  board [old_row][old_col] = piece;
  board [row][col] = temp;

  return !stillInCheck;
}

function make_draggable(piece, row, col) {
    let pieceType = board[row][col];
    let playerColor = sessionStorage.getItem("playerColor");

    if (!pieceType || pieceType[0] !== playerColor) {
        return;
    }

    piece.draggable = true;

    piece.addEventListener("dragstart", (event) => {
        let dragData = JSON.stringify({ row, col });
        console.log("Drag started with data:", dragData);
        event.dataTransfer.setData("application/json", dragData);  
        event.dataTransfer.effectAllowed = "move"; 
        selected_piece = { row, col };
    });

    piece.addEventListener("dragend", () => {
        selected_piece = null;
    });
}

function make_droppable(square, row, col) {
    if (!gameStarted) return;

    square.addEventListener("dragover", (event) => event.preventDefault());

    square.addEventListener("drop", (event) => {
        event.preventDefault();
        if (!gameStarted) return;

        let dataString = event.dataTransfer.getData("application/json");
        let data;

        console.log("Raw drop data:", dataString);

        try {
            if (!dataString) throw new Error("No data received!");
            data = JSON.parse(dataString);
            console.log("Drop received:", data);
        } catch (error) {
            console.error("Invalid data format:", dataString, error.message);
            generate_board();
            return;
        }

        let old_row = data.row;
        let old_col = data.col;
        let piece = board[old_row][old_col];
        let playerColor = sessionStorage.getItem("playerColor");

        if (!piece || piece[0] !== playerColor) {
            generate_board();
            return;
        }

        if (old_row === row && old_col === col) {
            generate_board();
            return;
        }

        if (board[row][col] !== null && board[row][col][0] === piece[0]) {
            generate_board();
            return;
        }

        if (is_valid_move_with_check_checking(old_row, old_col, row, col, piece)) {
            move_piece(old_row, old_col, row, col);
        } else {
            generate_board();
        }
    });
}

const API_URL = "https://zbwjw2pdz0.execute-api.us-east-1.amazonaws.com/prod"; 

async function createGame() {
  let response = await fetch(`${API_URL}/create-game`, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createGame" })
  });

  let data = await response.json();
  let gameId = data.gameId;

  alert(`Game Created! Share this Game ID: ${gameId}`);
  sessionStorage.setItem("gameId", gameId);
  
  startGame();
}

async function joinGame() {
  let gameId = prompt("Enter Game ID:");
  if (!gameId) return;

  let response = await fetch(`${API_URL}/join-game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "joinGame", gameId })
  });

  let data = await response.json();
  if (data.message === "Game not found") {
    alert("Invalid Game ID!");
  } else {
    sessionStorage.setItem("gameId", gameId);
    sessionStorage.setItem("playerColor", data.playerColor);
    board = data.board;
    startGame();
  }
}

function startGame() {
    gameStarted = true;
    enable_board();
    document.getElementById("turn_indicator").style.display = "block";
    document.getElementById("button_container").style.display = "none";
    generate_board();
}

function disable_board() {
  document.querySelectorAll(".piece").forEach(piece => piece.draggable = false);
}

function enable_board() {
  document.querySelectorAll(".piece").forEach(piece => piece.draggable = true);
}

async function sendMove() {
    let gameId = sessionStorage.getItem("gameId");
    if (!gameId) return;

    await fetch(`${API_URL}/make-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "makeMove", gameId, board })
    });

    await fetchGameState();
}

function resetGame() {
    gameStarted = false;
    document.getElementById("turn_indicator").style.display = "none";
    document.getElementById("button_container").style.display = "block";
    disable_board();
    generate_board();
}

async function fetchGameState() {
    let gameId = sessionStorage.getItem("gameId");
    if (!gameId) {
      generate_board();
      return;
    }

    let response = await fetch(`${API_URL}/join-game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "joinGame", gameId })
    });

    let data = await response.json();
    if (data.board) {
        board = data.board;
        generate_board();
    }
}

setInterval(fetchGameState, 2000);

async function initializeGame() {
    generate_board();
    await fetchGameState();
}

initializeGame();
