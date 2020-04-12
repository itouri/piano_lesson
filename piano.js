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
var _take_times = []; //各音符にかかった時間:連想配列
var _previous_time;

var _score = 0;
var _init_score = 0;
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
	// 数字でないならそのまま帰す
	if (isNaN(noteNum)) {
		return noteNum;
	}

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
			if ( _sel_lange == 1 ) {
				g_clef_note += code;
			}
			// ヘ音に音符を表示
			if ( _sel_lange == 2 ) {
				f_clef_note += code;
			}

			g_clef +=  g_clef_note;
			f_clef +=  f_clef_note;
		});

		g_clef += "]";
		f_clef += "]";
	});

	//console.log(_ques)

	g_clef = head + attrs[2][0] + g_clef + "||";
	f_clef = head + attrs[3][0] + f_clef + "||";

	// かかった時間を音符の下にくっつける
	if (_game_state == GAME_STATE.STAND_BY && _take_times.length != 0) {
		take_times_str = "\nw:"
		for (let i = 0; i < DISPLAY_NOTES; i++) {
			take_times_str += Math.round(_take_times[i].time / 1000) + " ";
		}

		g_clef += take_times_str
		f_clef += take_times_str
	}

	//console.log(g_clef)

	//str = head + attrs[i*2][0] + str;
	//str2 = head + attrs[i*2+1][0] + str2;

	//TODO いらない記号を表示しない
	//console.log(_sel_lange);

	// 楽譜のサイズ
	const params = {
		scale: 3,
	};

	switch (_sel_lange) {
		// 暫定的にぜんぶを廃止
		case 1:
			ABCJS.renderAbc(attrs[2][1], g_clef, params);
			break;
		case 2:
			ABCJS.renderAbc(attrs[3][1], f_clef, params);
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
	if ( hit == _ques[0].length ) {
		// ゲーム中ならスコアをプラス
		if ( _game_state == GAME_STATE.PLAYING ) {
			// かかった時間を集計
			now = new Date();
			let diff = now.getTime() - _previous_time.getTime();

			code = noteNumToCode(_ques[0]);

			// すでにコードが登録されているか検索
			var res = _take_times.filter(function(item, index){
				if (item.code == code) {
					item.time += diff;
					return true;
				}
			});

			console.log(res);

			// ないなら 0 で初期化
			if (res.length == 0) {
				memo = {};
				memo.code = code;
				memo.time = diff;

				console.log(code + " inited");

				_take_times.push(memo);
	
			}
			_previous_time = now;

			_score--;
			// 効果音再生
			_se_accept.play();
			$("#score").text("REMAIN: " + _score);
		}
		// 正解したので先頭の音符を取り除く
		_ques.shift();
		question();

		if (!_ques[0]) {
			game_over();
			return;
		}
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

/**
 * 参考：https://qiita.com/nagito25/items/0293bc317067d9e6c560
 * 
 * 任意の桁で四捨五入する関数
 * @param {number} value 四捨五入する数値
 * @param {number} base どの桁で四捨五入するか（10→10の位、0.1→小数第１位）
 * @return {number} 四捨五入した値
 */
function orgRound(value, base) {
    return Math.round(value * base) / base;
}

function random(min, max) {
	return Math.floor( Math.random() * (max - min + 1) ) + min;
}

var _count_down;
var _count_up;
var _start_date;

function game_start() {
	if ( _game_state == GAME_STATE.STAND_BY ) {
		_count_up = setInterval(count_up, 1000);
	}

	// 問題の初期化
	_ques.splice(0, _ques.length);
	init_question_pool();
	_score = _ques_pool.length;
	_init_score = _score;

	for (let i = 0; i < DISPLAY_NOTES; i++) {
		question();		
	}

	// 時間計測（setIntervalは当てにならない）
	_start_date = new Date();
	_previous_time = new Date();

	_game_state = GAME_STATE.PLAYING;
	_time = 0; //FIXME 0だと違和感がある
	//count_down();
	//count_up();
	$("#score").text("REMAIN: " + _score);
}

function diff_sec() {
	now = new Date();
	let diff = now.getTime() - _start_date.getTime() ;

	//ミリ秒から秒に変換
	diff /= 1000;

	// 少数第二位で四捨五入
	diff = Math.round(diff * 10) / 10

	return diff
}

// https://qiita.com/n0bisuke/items/f2dd06bfb0e4daa1e0d8
// dataは破壊的
function object_array_sort(data,key,order){
    //デフォは降順(DESC)
    var num_a = -1;
    var num_b = 1;

    if(order === 'asc'){//指定があれば昇順(ASC)
      num_a = 1;
      num_b = -1;
    }

   data = data.sort(function(a, b){
      var x = a[key];
      var y = b[key];
      if (x > y) return num_a;
      if (x < y) return num_b;
      return 0;
    });

	// なぜ関数をコールバックしている？
	//fn(data); // ソート後の配列を返す
	return data
}

function game_over() {
	_game_state = GAME_STATE.STAND_BY;
	//$("#time").text("FINISH!");
	_se_finish.play();
	console.log("tick");

	clearInterval(_count_up);

	// 各音符にかかった時間の集計
	take_times = object_array_sort(_take_times, 'time', 'dsc');

	const avg = Math.round(diff_sec()/_init_score);
	$("#time").text("TIME: " + diff_sec() + " avg:" + avg);

	disp_weak();
}

function disp_weak() {
	// 本当は良くないけど ques にぶち込んでる
	for (let i = 0; i < DISPLAY_NOTES; i++) {
		_ques[i] = [take_times[i].code];
	}
	console.log(take_times);
	console.log(_ques);

	render();
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

