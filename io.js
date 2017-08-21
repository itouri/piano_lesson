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
    // if (e.data[2] == 0) { // Yamaha
    if (e.data[0] == 0x80) { // Roland
    	for (var j = _hold.length - 1; j >= 0; j--) {
    		if ( _hold[j] == e.data[1]) {
    			_hold.splice(j,1);
    		}
    	}
    }

    // ピアノの鍵盤でスタートできるようにする			
    if (e.data[0] == 0x80 && e.data[1] == 0x15 && _game_state == GAME_STATE.STAND_BY) {
    	_hold.push(e.data[1]);
    	game_start();
    }
	// console.log("Hold="+_hold);
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