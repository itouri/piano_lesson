navigator.requestMIDIAccess().then(successCallback,faildCallback);

var GAME_STATE = {
		STAND_BY : 0,
		PLAYING : 	1,
		RESULT : 	2,
};

var MAX_TIME = 60 + 1;
var DISPLAY_NOTES = 8;
var TO_LOOP_NUM = 3;
var HE_LOOP_NUM = 4;

var midi = null;
var inputs = [];
var outputs = [];

var _hold = [];
var _ques = []; // 二次元配列

var _score = 0;
var _time;
var _game_state = GAME_STATE.STAND_BY;

var vector = ["C","^C","D","^D","E","F","^F","G","^G","A","^A","B"];

// 効果音
var _se_finish	= new Audio("./se/finish.mp3");
var _se_start	= new Audio("./se/start.mp3");
var _se_accept	= new Audio("./se/accept.mp3");

// 問題のプール
var _ques_pool = [];

// 音域
var ranges = [
	//TODO 具体的な数字を使わない
	[0x24, 0x5b], // すべて
	[0x35, 0x5b], // ト音のみ
	[0x24, 0x40], // ヘ音のみ
];

var _sel_note=0, _sel_display_code=1, _sel_lange=1, _sel_scale=0, _sel_sharp=0;
var _sel_codes = [0];


function noteNumToCode(noteNum) {
	// オクターブ調整
	var octave = Math.floor(noteNum / 12) - 2;
	var octave_str = "";

	if ( octave > 3 ) {
		octave_str = Array(octave - 3 + 1).join('\'');
	} else if ( octave < 3 ) {
		octave_str = Array(3 - octave + 1).join(',');
	}

	const code = vector[ noteNum % 12 ] + octave_str;
	return code;
}


function render() {
	var id = "";

	var head = "L:1/4\n";
	var attrs = [
		["K:C\n"	 , "ans" ],
		["K:C bass\n", "ans2"],
		["K:C\n"     , "ques"  ],
		["K:C bass\n", "ques2" ],
	];

	var g_clef = "";
	var f_clef = "";

	_ques.forEach(function(nodes) { 

		if (!nodes) {
			// breakがしたい
			// 参照元:https://www.deep-rain.com/programming/javascript/778#forbreakcontinuereturnforEach
			return true;	
		}

		//XXX なぜ逆順？
		//for (var j = nodes.length - 1; j >= 0; j--) {
		let g_clef_note = ""
		let f_clef_note = ""

		//console.log(nodes);

		g_clef += "[";
		f_clef += "[";

		nodes.forEach(function(node){
			let code = noteNumToCode(node);
			//console.log(nodes);

			// ト音に音符を表示
			if ( node >= 0x35 ) {
				g_clef_note += code;
			}
			// ヘ音に音符を表示
			if ( node <= 0x43 ) {
				f_clef_note += code;
			}

			g_clef +=  g_clef_note;
			f_clef +=  f_clef_note;
		});

		g_clef += "]";
		f_clef += "]";
	});

	console.log(_ques)

	g_clef = head + attrs[2][0] + g_clef + "||";
	f_clef = head + attrs[3][0] + f_clef + "||";

	console.log(g_clef)

	//str = head + attrs[i*2][0] + str;
	//str2 = head + attrs[i*2+1][0] + str2;

	//TODO いらない記号を表示しない
	console.log(_sel_lange);

	// 楽譜のサイズ
	const scale = 4;

	switch (_sel_lange) {
		// 暫定的にぜんぶを廃止
		case 1:
			ABCJS.renderAbc(attrs[2][1], g_clef, {scale: scale});
			break;
		case 2:
			ABCJS.renderAbc(attrs[3][1], f_clef, {scale: scale});
			break;
		default:
			//ABCJS.renderAbc(attrs[2][1], g_clef);
			break;
	}
}

function check_ans() {
	//FIXME _quesがundefinedで満たされていく

	if (_game_state == GAME_STATE.STAND_BY) {
		return;
	}

	if (!_ques[0]) {
		game_over();
		return;
	}

	// 押してる方の数が多いなら判定しない
	if ( _hold.length > _ques[0].length ) {
		return;
	}
	var hit = 0;
	//TODO O(n^2)
	for (var i = _ques[0].length - 1; i >= 0; i--) {
		for (var j = _hold.length - 1; j >= 0; j--) {
			if ( _ques[0][i] == _hold[j] ) {
				hit += 1;
			}
		}
	}
	if ( hit == _ques[0].length || true) {
		// ゲーム中ならスコアをプラス
		if ( _game_state == GAME_STATE.PLAYING ) {
			_score--;
			// 効果音再生
			_se_accept.play();
			$("#score").text("REMAIN: " + _score);
		}
		// 正解したので先頭の音符を取り除く
		_ques.shift();
		question();
	}
}

function init_question_pool() {
	// 問題に偏りが無いようにしたい
	//TODO 汚い
	_ques_pool = [];
	sharps = [0, 2, 4, 5, 7, 9, 11];
	pools = [];
	for (let i = ranges[_sel_lange][0]; i < ranges[_sel_lange][1]; i++) {
		// シャープのノートでない
		if (sharps.indexOf(i % 12) !== -1) {
			// コードとの整合性を取るために配列として格納
			pools.push([i]);
		}
	}

	//コピペ https://www.nxworld.net/tips/js-array-shuffle.html
	const shuffle = ([...array]) => {
		for (let i = array.length - 1; i >= 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	let LOOP_NUM = (_sel_lange == 1) ? TO_LOOP_NUM : HE_LOOP_NUM;

	for (let i = 0; i < LOOP_NUM; i++) {
		_ques_pool = _ques_pool.concat(shuffle(pools));
	}

	console.log(_ques_pool);
}

// question_poolから問題を取得
// コードの場合は違う
function question() {
	// 問題をリセット _ques = []; ではダメ
	// TODO リセットしてはいけない
	// _ques.splice(0, _ques.length);

	//let q = [];

	//var rand;
	//var ng =  ( _sel_sharp == 1 ) ? false : true;

	// rand = random(ranges[_sel_lange][0], ranges[_sel_lange][1]);

	// while ( ng ) {
	// 	//TODO うーん randを2回抽選しちゃう
	// 	rand = random(ranges[_sel_lange][0], ranges[_sel_lange][1]);
	// 	switch (rand % 12) {
	// 		case 0: case 2: case 4: case 5: case 7: case 9: case 11:
	// 		ng = false;
	// 		break;
	// 	}
	// }

	// q.push(rand);

	if (_ques_pool) {
		q = _ques_pool.pop();
		_ques.push(q);
	}

	// // コードON
	// if ( _sel_note == 1 ) {
	// 	var crand = random(0, _sel_codes.length - 1);
	// 	var index = _sel_codes[crand];
	// 	console.log(index);

	// 	//                        音階名               コード名
	// 	var code_name = "CODE: "+ vector[rand % 12] + codes[index][0];

	// 	// コードをpush			
	// 	for (var i = 1; i < codes[index].length; i++) {
	// 		q.push(rand + codes[index][i]);
	// 	}

	// 	if ( _sel_display_code == 1 ) {
	// 		$("#code").text(code_name);
	// 	}
	// }

	//_ques.push(q);

	// console.log("RAND: " + rand);
	render();

	// 問題がなくなったら終了
	// if (_ques.length == 0) {
	// 	game_over();
	// }
}

function random(min, max) {
	return Math.floor( Math.random() * (max - min + 1) ) + min;
}

var _count_down;
var _count_up;

function game_start() {
	if ( _game_state == GAME_STATE.STAND_BY ) {
		_count_up = setInterval(count_up, 1000);
	}

	// 問題の初期化
	_ques.splice(0, _ques.length);
	init_question_pool();
	_score = _ques_pool.length;

	for (let i = 0; i < DISPLAY_NOTES; i++) {
		question();		
	}

	_game_state = GAME_STATE.PLAYING;
	_time = 0;
	//count_down();
	count_up();
	$("#score").text("REMAIN: " + _score);
}

function game_over() {
	_game_state = GAME_STATE.STAND_BY;
	//$("#time").text("FINISH!");
	_se_finish.play();
	console.log("tick");
}

var count_down = function () {
	_time--;
	$("#time").text("TIME: " + _time);
	if ( _time <= 0 ) {
		clearInterval(_count_down);
		game_over();
	} 
}

var count_up = function () {
	if ( _game_state == GAME_STATE.PLAYING ) {
		_time++;
		$("#time").text("TIME: " + _time);
	}
}

function init() {
	//TODO プルダウン，各種設定項目の初期設定
	//_ques.splice(0, _ques.length);
	//question();
	render();

	$("#div_display_code").hide();
	$("#div_code").hide();
}

// 各プルダウンの値を取得
$(function($) {
	$("#sel_note").change( function(){
		_sel_note = $("#sel_note").val();
		switch ( _sel_note ) {
			//TODO 0, 1 ではなぜできない? 
			case "0":
			$("#div_display_code").hide();
			$("#div_code").hide();
			break;
			case "1":
			$("#div_display_code").show();
			$("#div_code").show();
			break;
		}
	});

	// 選択されたコードの取得
	$("#div_code").change( function(){
		_sel_codes = $('[class="code"]:checked').map(function(){
	  	//$(this)でjQueryオブジェクトが取得できる。val()で値をvalue値を取得。
	  	return $(this).val();
	  }).get();

	  // 何もチェックされてないなら STARTボタンを disable にする
	  if ( _sel_codes.length == 0 ) {
		  $("#btn_start").prop("disabled", true);
	  } else {
		  $("#btn_start").prop("disabled", false);
	  }
	});

	$("#sel_display_code").change( function(){
		_sel_display_code = $("#sel_display_code").val();
	});

	$("#sel_lange").change( function(){
		_sel_lange = $("#sel_lange").val();
		_sel_lange = parseInt(_sel_lange);

		switch ( _sel_lange ) {
			//TODO 0, 1 ではなぜできない? 
			case 1:
				$("#to-row").show();
				$("#he-row").toggle();
				break;
			case 2:
				$("#to-row").toggle();
				$("#he-row").show();
			break;
		}
	});

	$("#sel_sharp").change( function(){
		_sel_sharp = $("#sel_sharp").val();
	});

	$("#sel_scale").change( function(){
		_sel_scale = $("#sel_scale").val();

	});

	$("#tmp").click( function(){
		render();
		check_ans();
	});

	$("#btn_start").click( function(){
		game_start();
	});
});

