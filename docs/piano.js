	navigator.requestMIDIAccess().then(successCallback,faildCallback);

	var GAME_STATE = {
		 STAND_BY : 0,
		 PLAYING : 	1,
		 RESULT : 	2,
	};

	var MAX_TIME = 30 + 1;

	var midi = null;
	var inputs = [];
	var outputs = [];

	var _hold = [];
	var _ques = [];

	var _score = 0;
	var _time;
	var _game_state = GAME_STATE.STAND_BY;

	var vector = ["C","^C","D","^D","E","F","^F","G","^G","A","^A","B"];

// 音域
var ranges = [
	[36, 96], // すべて
	[60, 96], // ト音のみ
	[60, 77], // ト音 高音域なし	
	[36, 59], // ヘ音のみ
];

	var _sel_note=0, _sel_display_code=1, _sel_lange=0, _sel_scale=0, _sel_sharp=1;
	var _sel_codes = [];

// MIDI接続成功時
function successCallback(m){
	console.log("asd");
	midi = m;
  // 入力MIDIデバイスの記録
  var it = midi.inputs.values();
  for(var o = it.next(); !o.done; o = it.next()){
  	inputs.push(o.value);
  	$("#input").append("<li>"+ o.value.name +"</li>");
  }

  // 出力MIDIデバイスの記録
  var ot = midi.outputs.values();
  for(var o = ot.next(); !o.done; o = ot.next()){
  	outputs.push(o.value);
  	$("#output").append("<li>"+ o.value.name +"</li>");
  }

  // 入力MIDIデバイスから入力が来たときの処理の登録
  for(var cnt=0;cnt < inputs.length;cnt++){
  	inputs[cnt].onmidimessage = onMIDIEvent;
  }
}

// MIDI接続失敗時
function faildCallback(msg){
	console.log("[Error]:"+msg);
}

//入力MIDIデバイスから入力が来たときの処理
function onMIDIEvent(e){
  var str = "";
  var vec = "";
  for(var i=0, out=[]; i<e.data.length; i++) {
    str = str + e.data[i].toString(16).substr(-2) + " ";

	// f8だったら無視
	if ( str == "f8 " || str == "fe " ) {
		return;
	}

    // 第二要素である 音階を格納
    if (i == 1 && e.data[2] != null && e.data[2] != 0) {
    	_hold.push(e.data[1]);
    }

    // 第三要素が0なら離したってこと
    if (e.data[2] == 0) {
    	for (var j = _hold.length - 1; j >= 0; j--) {
    		if ( _hold[j] == e.data[1]) {
    			_hold.splice(j,1);
    		}
    	}
    }
	console.log(_hold);
	//console.log(str);
  }
  $("#data").text(str);

   // 押してる音階を表示
  str = ""
  for (var j = _hold.length - 1; j >= 0; j--) {
  	str = str + vector[ _hold[j] % 12] + " ";
  }
  if ( str == "" ) {
  	str = "--"
  }
  $("#vector").text(str);
  render();
  check_ans();
}

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

			if ( nodes[j] >= 60 ) {
				str = str + vector[ nodes[j] % 12 ] + octave_str;
			} else {
				str2 = str2 + vector[ nodes[j] % 12 ] + octave_str;
			}
		}

		str = "[" + str + "]||";
		str2 = "[" + str2 + "]||";

		str = head + attrs[i*2][0] + str;
		str2 = head + attrs[i*2+1][0] + str2;

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
	//if ( hit == _ques.length ) {
	if ( true ) { //test!!!
		// ゲーム中ならスコアをプラス
		if ( _game_state == GAME_STATE.PLAYING ) {
			_score++;
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
		var type = random(0, _sel_codes.length - 1);

		//                        音階名               コード名
		var code_name = "CODE: "+ vector[rand % 12] + codes[type][0];

		// コードをpush			
		for (var i = 1; i < codes[type].length; i++) {
			_ques.push(rand + codes[type][i]);
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
