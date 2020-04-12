navigator.requestMIDIAccess().then(successCallback,faildCallback);

var GAME_STATE = {
		STAND_BY : 0,
		PLAYING : 	1,
		RESULT : 	2,
};

var MAX_TIME = 60 + 1;

var midi = null;
var inputs = [];
var outputs = [];

var _hold = [];
var _ques = [];

var _score = 0;
var _time;
var _game_state = GAME_STATE.STAND_BY;

var vector = ["C","^C","D","^D","E","F","^F","G","^G","A","^A","B"];

// 効果音
var _se_finish	= new Audio("./se/finish.mp3");
var _se_start	= new Audio("./se/start.mp3");
var _se_accept	= new Audio("./se/accept.mp3");

// 音域
var ranges = [
	//TODO 具体的な数字を使わない
	[0x24, 0x5b], // すべて
	[0x35, 0x5b], // ト音のみ
	[0x24, 0x40], // ヘ音のみ
];

var _sel_note=0, _sel_display_code=1, _sel_lange=0, _sel_scale=0, _sel_sharp=1;
var _sel_codes = [0];


function render() {
	var head = "";
	var id = "";

	var head = "M:4/4\nL:1/4\n";
	var attrs = [
		["K:C\n"	 , "ans" ],
		["K:C bass\n", "ans2"],
		["K:C\n"     , "ques"  ],
		["K:C bass\n", "ques2" ],
	];

	for (var i = 0; i < 2; i++) {
		var nodes;

		if ( i == 0 ){
			nodes = _hold.slice(0);
		} else {
			nodes = _ques.slice(0);
		}

		var str = "";
		var str2 = "";
		for (var j = nodes.length - 1; j >= 0; j--) {
			// オクターブ調整
			var octave = Math.floor(nodes[j] / 12) - 2;
			var octave_str = "";

			if ( octave > 3 ) {
				octave_str = Array(octave - 3 + 1).join('\'');
			} else if ( octave < 3 ) {
				octave_str = Array(3 - octave + 1).join(',');
			}

			// ト音に音符を表示
			if ( nodes[j] >= 0x35 ) {
				str = str + vector[ nodes[j] % 12 ] + octave_str;
			}
			// ヘ音に音符を表示
			if ( nodes[j] <= 0x43 ) {
				str2 = str2 + vector[ nodes[j] % 12 ] + octave_str;
			}
		}

		str = "[" + str + "]||";
		str2 = "[" + str2 + "]||";

		str = head + attrs[i*2][0] + str;
		str2 = head + attrs[i*2+1][0] + str2;

		//TODO いらない記号を表示しない
		ABCJS.renderAbc(attrs[i*2][1]  , str );
		ABCJS.renderAbc(attrs[i*2+1][1], str2);
	}
}

function check_ans() {
	// 押してる方の数が多いなら判定しない
	if ( _hold.length > _ques.length ) {
		return;
	}
	var hit = 0;
	//TODO O(n^2)
	for (var i = _ques.length - 1; i >= 0; i--) {
		for (var j = _hold.length - 1; j >= 0; j--) {
			if ( _ques[i] == _hold[j] ) {
				hit += 1;
			}
		}
	}
	if ( hit == _ques.length ) {
		// ゲーム中ならスコアをプラス
		if ( _game_state == GAME_STATE.PLAYING ) {
			_score++;
			// 効果音再生
			_se_accept.play();
			$("#score").text("SCORE: " + _score);
		}
		question();
	}
}

function question() {
	// 問題をリセット _ques = []; ではダメ
	_ques.splice(0, _ques.length);

	var rand;
	var ng =  ( _sel_sharp == 1 ) ? false : true;

	rand = random(ranges[_sel_lange][0], ranges[_sel_lange][1]);

	while ( ng ) {
		//TODO うーん randを2回抽選しちゃう
		rand = random(ranges[_sel_lange][0], ranges[_sel_lange][1]);
		switch (rand % 12) {
			case 0: case 2: case 4: case 5: case 7: case 9: case 11:
			ng = false;
			break;
		}
	}

	_ques.push(rand);

	// コードON
	if ( _sel_note == 1 ) {
		var crand = random(0, _sel_codes.length - 1);
		var index = _sel_codes[crand];
		console.log(index);

		//                        音階名               コード名
		var code_name = "CODE: "+ vector[rand % 12] + codes[index][0];

		// コードをpush			
		for (var i = 1; i < codes[index].length; i++) {
			_ques.push(rand + codes[index][i]);
		}

		if ( _sel_display_code == 1 ) {
			$("#code").text(code_name);
		}
	}

	console.log("RAND: " + rand);
	render();
}

function random(min, max) {
	return Math.floor( Math.random() * (max - min + 1) ) + min;
}

var _count_down;

function game_start() {
	if ( _game_state == GAME_STATE.STAND_BY ) {
		_count_down = setInterval(count_down, 1000);
	}
	question();
	_game_state = GAME_STATE.PLAYING;
	_time = MAX_TIME;
	count_down();
	_score = 0;
	$("#score").text("SCORE: " + _score);
}

function game_over() {
	_game_state = GAME_STATE.STAND_BY;
	$("#time").text("FINISH!");
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

function init() {
	//TODO プルダウン，各種設定項目の初期設定
	question();
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

