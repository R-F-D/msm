/* *******************************************************************************
	GamePlayシーン
********************************************************************************/
var Scene	= Scene || {};
(function(){	//File Scope

/** 打撃定数 */
const BlowPower	= {
	/**下限値*/			MIN				: -30*256,
	/**上限値*/			MAX				: 60*256,
	/**初期値*/			INITIAL			: 0,
	/**増分*/			INCREMENT		: 1*256,
	/**失敗時の減少*/	DECREMENT		: 1*256,
	/**主動作の速度*/	DISCHARGE_SPEED	: 4*256,
	/**主動作の加速度*/	ACCELERATION	: 1.20,
};
/** エミットエナジー定数*/
const EmitEnergy	= {
	/**エミット受付期間*/	ACCEPTION_COUNT		: 300,
	/**エミット加算値*/		ADDITIONAL_POWER	: 128,
};
/** リンクされたレイヤーのタグ */
const LinkedLayerTags	= {
	MAIN	: "GamePlay.Main",
	BG		: "GamePlay.Bg",
	UI		: "GamePlay.Ui",
};

Scene.GamePlay	= class extends Scene.SceneBase {

	/** シークエンス列挙型 */
	Sequences	= {
		/**初期状態*/		INITIAL			: null,
		/**エイム作動*/		START_AIM		: null,
		/**打撃予備動作*/	PRELIMINARY		: null,
		/**打撃動作*/		DISCHARGE		: null,
		/**エミット中*/		EMIT			: null,
		/**吹き飛ばし*/		BLOW_AWAY		: null,
		/**測定中*/			MEASURE			: null,
		/**動作失敗*/		DISCHARGE_FAILED: null,
	};

	constructor(){
		super();

		/** @var 座標 */
		this.POSITIONS	= {
			PLAYER	: {	X:96,	Y:96,	},
			METEOR	: {	X:192,	Y:144,	},
		};

		//インパクトシークエンス
		/** @var チャージ時間 */
		this.chargingCount		= BlowPower.INITIAL;
		/** @var チャージ量 */
		this.chargedPower		= 0;
		/** 打撃動作のアニメーション速度 */
		this.dischargeSpeed		= 0;
		/** @var エイミングゲージ */
		this.aiming				= null;

		//エミットエナジーシークエンス
		/** @var エミット受付時間*/
		this.acceptEmitting		= 0;
		/** @var エミットカウンタ */
		this.nEmits	= {
			/**合計 */		total		: 0,
			/**同時*/		simul		: 0,
			/**同時最大*/	maxSimul	: 1,
		};

		//背景スクロール
		this.bgScroll		= 0;
		this.bgScrollSpeed	= -8;

		//結果表示用
		/** @var インパクト時の威力*/
		this.impactPower		= 0;
		/** @var 最終的に与えられた威力 */
		this.totalPower			= 0;
		/** @var 隕石の移動距離 */
		this.distanceOfMeteor	= 0;
		this.isOnGround			= true;

		this.UIs	= {};

		/** ccSceneのインスタンス */
		this.ApplicateCcSceneInstance(this).InitLayerList();		

		/** ラベル */
		this.labels	= {
			aimingResult:null, hitArea:null, distance:null,	navigation:null,
		}

		//シークエンス設定
		for(let i in this.Sequences){ this.Sequences[i] = Scene.Sequence.Create() }
		this.SetSequenceFunctions().InitEventListenerList();
	}


	/** シーケンス毎の処理を定義
	 * @returns this
	 */
	SetSequenceFunctions(){

		//初期状態
		this.Sequences.INITIAL.PushStartingFunctions(()=>{
			this.bgScroll			= 0;
			this.bgScrollSpeed		= -8;
			this.chargingCount		= BlowPower.INITIAL;
			this.chargedPower		= 0;
			this.dischargeSpeed		= 0;
			this.distanceOfMeteor	= 0;
			this.sprites.hitArea.SetVisible(false).SetScale(0);
			this.sprites.meteor.SetVisible(true);
			this.sprites.distance.SetVisible(false);
			this.sprites.player.SetCustomData("adjY",-100).SetCustomData("dy",3);
			this.fx.player.SetVelocity(-1,-0.5,0.5,0);
			this.fx.meteor.SetVelocity(8,3);
			this.fx.meteor.SetColor();
			this.fx.preliminary.Destroy();
			this.labels.aimingResult.SetVisible(false);
			this.labels.distance.SetVisible(false);
			this.labels.navigation.Init().SetVisible(false);

			const size	= cc.director.getWinSize();
			for(let s of this.sprites.bg1)	s.SetPosition(0,512/2).SetOpacity(255).SetVisible(true);
			for(let s of this.sprites.bg2)	s.SetPosition(0,size.height/2).SetOpacity(255).SetVisible(false);
			this.aiming.SetVisible(false);

			(this.UIs.resultButtons||[]).forEach( button=>button.removeFromParent() );	//リザルト画面のボタンを初期化
		})
		.PushUpdatingFunctions((dt)=>{
			this.aiming.Update(false);
			if(this.sequence.count > 60)	this.SetSequence(this.Sequences.START_AIM);
		});

		//エイム作動
		this.Sequences.START_AIM
			.PushStartingFunctions(()=>{
				this.labels.navigation.SetString(L.Text("GamePlay.Navigator.Aim")).SetVisible(true);
				this.aiming.SetVisible(true,true);
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update();
			});

		//打撃予備動作
		this.Sequences.PRELIMINARY
			.PushStartingFunctions(()=>{
				this.fx.preliminary.Spawn(64,48);
				this.labels.navigation.SetString(L.Text("GamePlay.Navigator.Preliminary")).SetVisible(true);
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update();
				this.fx.preliminary.Update();
				this.chargingCount += BlowPower.INCREMENT;
				if(this.chargingCount > BlowPower.MAX)	this.SetSequence(this.Sequences.DISCHARGE_FAILED);
			});

		//打撃動作
		this.Sequences.DISCHARGE
			.PushStartingFunctions(()=>{
				this.chargedPower	= this.chargingCount;
				this.dischargeSpeed	= BlowPower.DISCHARGE_SPEED;
				this.fx.preliminary.Destroy();
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update();
				this.dischargeSpeed *= BlowPower.ACCELERATION;
				this.chargingCount -= this.dischargeSpeed;
				if(this.chargingCount < BlowPower.MIN){
					this.SetSequence(this.Sequences.EMIT);
				}
			});

		//打撃動作失敗
		this.Sequences.DISCHARGE_FAILED
			.PushStartingFunctions(()=>{
				this.fx.preliminary.Destroy();
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update();
				this.chargingCount-=BlowPower.DECREMENT;
				if(this.chargingCount < 0)	this.SetSequence(this.Sequences.START_AIM);
			});

		//エミット中
		this.Sequences.EMIT
			.PushStartingFunctions(()=>{
				this.nEmits.simul		= 0;
				this.nEmits.maxSimul	= 1;
				this.acceptEmitting		= EmitEnergy.ACCEPTION_COUNT;
				this.nEmits.total		= 0;

				this.sprites.hitArea.SetIndex(this.aiming.GetCurrentArea().imgIndex).SetVisible(true).RunAction(
					cc.ScaleTo.create(0.25,1).easing(cc.easeBackOut(10))
				);

				this.labels.aimingResult.SetVisible(true);
				this.labels.navigation.SetString(L.Text("GamePlay.Navigator.Emit")).SetVisible(true);

				this.fx.hit.Spawn(this.sprites.player.x+32,this.sprites.player.y, this.playerHardblows()?2.0:1.0 );
				this.fx.player.SetVelocity(+1,+0.5,-2,-1);
				this.fx.meteor.SetVelocity(-8,-4).SetColor("#FFFF00");
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update(false);

				this.acceptEmitting--;
				if(this.acceptEmitting < 0)	this.SetSequence(this.Sequences.BLOW_AWAY);

				//マルチタッチ検出
				this.nEmits.maxSimul	= Math.max(this.nEmits.simul,this.nEmits.maxSimul);
				this.nEmits.simul		= 0;
			});

		//吹き飛ばし
		this.Sequences.BLOW_AWAY
			.PushStartingFunctions(()=>{
				this.impactPower		= this.GetChargingRate() * this.aiming.GetTotalRate();
				this.totalPower			= this.GetEmittingRate() * this.impactPower + 10;
				this.distanceOfMeteor	= 0;

				for(let s of this.sprites.bg2)	s.SetVisible(true);
				this.aiming.SetVisible(false);
				this.sprites.distance.SetVisible(true);
				this.sprites.hitArea.SetVisible(false);
				this.labels.aimingResult.SetVisible(false);
				this.labels.distance.SetVisible(true);
				this.labels.navigation.SetString(L.Text("GamePlay.Navigator.BrowAway.Start")).SetVisible(true);
			})
			.PushUpdatingFunctions((dt)=>{
				this.aiming.Update(false);

				const oldDistance	= this.GetDistanceInKm();
				this.distanceOfMeteor+= 0.2+NormalRandom(0.05);
				const newDistance	= this.GetDistanceInKm();

				const checkpoints	= [
					{	distance: 42000000,	text:L.Text("GamePlay.Navigator.BrowAway.Venus"),	},
					{	distance: 72000000,	text:null,	},
					{	distance: 78000000,	text:L.Text("GamePlay.Navigator.BrowAway.Mars"),	},
					{	distance: 91500000,	text:L.Text("GamePlay.Navigator.BrowAway.Mercury"),	},
					{	distance:121500000,	text:null,	},
					{	distance:149600000,	text:L.Text("GamePlay.Navigator.BrowAway.Sun"),		},
					{	distance:179600000,	text:null,	},
					{	distance:186200000,	text:L.Text("GamePlay.Navigator.BrowAway.Kirari"),	},
					{	distance:216200000,	text:null,	},
				];

				//前フレームの距離と現フレームの距離を見て、超えた瞬間にセリフを出す
				for(let i=0; i<checkpoints.length; ++i){
					if(oldDistance < checkpoints[i].distance && checkpoints[i].distance<=newDistance)
					{
						if(checkpoints[i].text)	this.labels.navigation.SetString(checkpoints[i].text).SetVisible(true);
						else					this.labels.navigation.SetVisible(false);
						break;
					}
				}
				
				if(this.totalPower <= this.distanceOfMeteor)	this.SetSequence(this.Sequences.MEASURE);
			})
			.PushUpdatingFunctions("layer-bg", (dt)=>{
				for(let sprite of this.sprites.bg1){
					sprite
						.SetRelativePosition(null,-4)
						.SetOpacity(Math.max(0,255-this.sequence.count*4));
				}
			});

		//計測中
		this.Sequences.MEASURE
			.PushStartingFunctions(()=>{
				for(let s of this.sprites.bg1)	s.SetVisible(false);
				this.sprites.meteor.SetVisible(false);
				this.sprites.distance.SetVisible(false);
				this.fx.explosion.Spawn(this.sprites.meteor.x,this.sprites.meteor.y);

				this.labels.distance.SetVisible(false);
				this.labels.navigation.SetString( L.Textf("GamePlay.Navigator.Measure", [L.NumToStr(this.GetDistanceInKm())+L.Text("GamePlay.Distance.Unit")] )).SetVisible(true);

				Log(`Emit: ${this.nEmits.total}c, ${this.nEmits.maxSimul}c/f, ${this.GetEmittingRate()}x`);
				Log(`AimingRate: ${this.aiming.GetRate(true)}`);
				Log(`Impact: ${this.impactPower}`);
				Log(`Total: ${this.totalPower}`);

				const size	= cc.director.getWinSize();
				this.UIs.resultButtons	= this.UIs.resultButtons || [];
				for(let i=0;i<2;++i){
					const imgs		= [rc.img.retryButton,rc.img.shareButton];
					const listeners	= [this.listeners.retryButton,this.listeners.shareButton];
					this.UIs.resultButtons[i]	= new ccui.Button(GetResPath(imgs[i]));
			
					this.UIs.resultButtons[i].setPosition(size.width/2-128+256*i,size.height/2);
					this.UIs.resultButtons[i].setScale(1);
					this.UIs.resultButtons[i].setContentSize(128,128);
					this.UIs.resultButtons[i].addTouchEventListener(listeners[i],this.ccLayerInstances[LinkedLayerTags.UI]);
					this.UIs.resultButtons[i].setSwallowTouches(false);
					this.ccLayerInstances[LinkedLayerTags.UI].addChild(this.UIs.resultButtons[i]);
				}

			});
			//.PushUpdatingFunctions((dt)=>{});

		return this;
	}

	OnEnter(){
		super.OnEnter();
		this.aiming	= Scene.Aiming
							.Create()
							.PushHitArea( "PERFECT",	-0.10,	0.10 )
							.PushHitArea( "GOOD",		-0.25,	0.25 )
							.PushHitArea( "NORMAL",		-0.75,	0.75 );

		this.SetLayer(LinkedLayerTags.BG,  this.ccLayers.bg,  0x0000)
			.SetLayer(LinkedLayerTags.UI,  this.ccLayers.ui,  0x0002)
			.SetLayer(LinkedLayerTags.MAIN,this.ccLayers.main,0x0001);	//各種処理があるのでmainレイヤは最後にセット
		this.InitSequence(this.Sequences.INITIAL,this.Sequences,this.ccLayerInstances[LinkedLayerTags.MAIN]);
		this.sequence.Init()

		return this;
	}

	OnUpdating(dt){
		super.OnUpdating(dt);
		this.isOnGround	= ![this.Sequences.BLOW_AWAY,this.Sequences.MEASURE ].includes(this.sequence);
		return this;
	}

	UpdateBgLayer(dt){
		const size		= cc.director.getWinSize();
		const bgWidth	= [this.sprites.bg1[0].img.width, this.sprites.bg2[0].img.width, ];

		this.bgScroll	+= this.bgScrollSpeed;
		if     ([this.Sequences.MEASURE].includes(this.sequence))					this.bgScrollSpeed	= MoveTo(this.bgScrollSpeed,0,0.05);
		else if([this.Sequences.EMIT,this.Sequences.BLOW_AWAY].includes(this.sequence))	this.bgScrollSpeed	= MoveTo(this.bgScrollSpeed,8,0.25);
		for(let i=0; i<2; ++i){
			this.sprites.bg1[i]
				.SetPosition(	size.width /2 - Cycle(this.bgScroll, 0, bgWidth[0]) + bgWidth[0]*i,
								null);
		}
		for(let i=0; i<4; ++i){
			this.sprites.bg2[i]
				.SetPosition(	size.width /2 - Cycle(this.bgScroll/2,0,bgWidth[1]) + bgWidth[1]*Math.trunc(i/2),
								size.height/2 - Cycle(this.bgScroll/4,0,bgWidth[1]) + bgWidth[1]*(i%2),	);
		}
		return this;
	}

	/** ccLayerに渡す用 */
	InitLayerList(){
		const _this	= this;
		super.InitLayerList()
			.AddToLayerList("main",{
				ctor:function(){
					this._super();
					this.init();
					this.scheduleUpdate();
					return true;
				},
				init	: function(){
					this._super();
					_this.sprites			= _this.sprites||{};
					_this.sprites.player	= Sprite.CreateInstance(rc.img.player).AddToLayer(this).SetScale(2).Attr({zIndex:5}).SetRotate(-5);
					_this.sprites.meteor	= Sprite.CreateInstance(rc.img.meteor).AddToLayer(this).SetScale(2).Attr({zIndex:2}).SetVisible(true);
					_this.sprites.distance	= Sprite.CreateInstance(rc.img.distance).AddToLayer(this).SetScale(1).Attr({zIndex:3}).SetVisible(false);
					_this.sprites.hitArea	= Sprite.CreateInstance(rc.img.hitArea).AddToLayer(this).Attr({zIndex:110}).SetVisible(false).SetPosition(48,140);

					_this.fx			= _this.fx||{};
					_this.fx.meteor		= Effect.Meteor.Create(8).Init(this);
					_this.fx.player		= Effect.Fly.Create(32).Init(this);
					_this.fx.explosion	= Effect.Explosion.Create(1).Init(this);
					_this.fx.preliminary= Effect.Preliminary.Create().Init(this);
					_this.fx.hit		= Effect.Hit.Create().Init(this);
					_this.fx.emit		= Effect.Emit.Create().Init(this);

					_this.aiming.Init().SetLayer(this).SetSpritePosition(164,80).SetVisible(false);

					//リセットボタン
					const size	= cc.director.getWinSize();
					let button	= new ccui.Button(GetResPath(rc.img.resetIcon));				
					button.setPosition(0+16+2,size.height-16-2);
					button.setScale(1);
					button.setOpacity(128);
					button.setContentSize(32,32);
					//button.setSwallowTouches(false);
					button.addTouchEventListener(_this.listeners.resetButton,this);
					this.addChild(button);

					//Labels
					_this.labels.aimingResult	= Label.CreateInstance(15,rc.font.talk).SetColor("#FFFFFF").SetPosition(64,105).AddToLayer(this);
					_this.labels.distance		= Label.CreateInstance(12,rc.font.distance).SetColor("#00FF00").AddToLayer(this);
					_this.labels.navigation		= Label.CreateInstance(15,rc.font.talk).SetColor("FFFFFF").SetIcon(rc.img.navigator).SetPosition(256,32).AddToLayer(this).SetBgEnabled(true).SetIconPosition(-4,0);

					_this.SetSequence(_this.Sequences.INITIAL);
					return true;
				},
				update	: function(dt){
					this._super();

					//Player
					_this.UpdatePlayerSprite();

					const m	={
						x:_this.POSITIONS.METEOR.X+Math.min(_this.distanceOfMeteor,250),
						y:_this.POSITIONS.METEOR.Y,
					}; 
					_this.sprites.meteor.SetPosition(m.x,m.y+NormalRandom(4)).Rotate(_this.isOnGround?-7:1);
					_this.sprites.distance.SetPosition(m.x+64+16+8,m.y-24);
					_this.fx.meteor.Spawn(_this.sprites.meteor.x,_this.sprites.meteor.y, _this.sequence.count%15==0 && _this.sequence!==_this.Sequences.MEASURE).Update();
					_this.fx.explosion.Update();
					_this.fx.hit.Update();
					_this.fx.emit.Update();
					_this.fx.touched.Update();

					_this.labels.aimingResult.SetString(`${_this.aiming.GetRate(true)}${L.Text("GamePlay.Charge.Unit")}`);
					_this.labels.distance.SetPosition(m.x+96+8,m.y-48+6).SetString(
						L.Textf("GamePlay.Distance.Emit",[
							L.NumToStr(_this.GetDistanceInKm(),"en"),
							L.Text("GamePlay.Distance.Unit","_")
						],"-")
					);

					let naviIcon	= Math.trunc(_this.count/4) % 32;
					naviIcon		= naviIcon<=3 ? naviIcon : 0;
					_this.labels.navigation.SetIconIndex(naviIcon).Update();

					return true;
				},
			})
			.AddToLayerList("bg",{
				ctor:function(){
					this._super();
					this.init();
					this.scheduleUpdate();
					return true;
				},
				init	: function(){
					this._super();
					//_this.SetBackgroundColor(this,"#000000");
					const size	= cc.director.getWinSize();
					_this.sprites		= _this.sprites||{};
					_this.sprites.bg2	= CreateArray(4).map(i=> Sprite.CreateInstance(rc.img.bg2).AddToLayer(this).SetVisible(false)	);
					_this.sprites.bg1	= CreateArray(2).map(i=> Sprite.CreateInstance(rc.img.bg1).AddToLayer(this).SetVisible(false)	);
				},
				update	: function(dt){
					this._super();
					_this.UpdateBgLayer(dt);
					_this.sequence.Update(dt,"layer-bg");
				},
			})
			.AddToLayerList("ui",{
				ctor:function(){
					this._super();
					//this.init();
					this.scheduleUpdate();
					return true;
				},/*
				init	: function(){
					this._super();
				},*/
				update	: function(dt){
					this._super();
					_this.sequence.Update(dt,"layer-ui");
				},
			});
			return this;
	}


	/** イベントリスナ初期設定
	 * @returns this
	 */
	InitEventListenerList(){
		super.InitEventListenerList()
			/** インパクトフェイズ */
			.AddPropertiesToEventListenerList("discharge",{
				event			: cc.EventListener.TOUCH_ALL_AT_ONCE,
				onTouchesBegan	: (touch,event)=>{
					if(this.sequence===this.Sequences.START_AIM){
						this.SetSequence(this.Sequences.PRELIMINARY);
						return true;
					}
					return false;
				},
				onTouchesEnded	: (touch,event)=>{
					if(this.sequence===this.Sequences.PRELIMINARY)	this.SetSequence(this.Sequences.DISCHARGE);
				},
			})
			/** エミットエナジーフェイズ */
			.AddPropertiesToEventListenerList("emitEnergy",{
				event			: cc.EventListener.TOUCH_ALL_AT_ONCE,
				onTouchesBegan	: (touch,event)=>{
					this.nEmits.simul++;
					this.nEmits.total++;
					this.fx.emit.Spawn(this.sprites.player.x,this.sprites.player.y);
				},
			})
			/**リセットボタン*/
			.AddToEventListenerList("resetButton",(sender,type)=>{
				if      (type===ccui.Widget.TOUCH_BEGAN){
					this.labels.navigation.SetTempText(L.Text("GamePlay.Navigator.Result.Reset"));
				}
				else if(type===ccui.Widget.TOUCH_ENDED){
					this.ResetForce();
				}
				else if (type===ccui.Widget.TOUCH_CANCELED){
					this.labels.navigation.RemoveTempText();
				}
				return true;
			})
			//キーボードリセット
			.AddPropertiesToEventListenerList("reset",{
				event			: cc.EventListener.KEYBOARD || null,
				onKeyReleased	: (code,event)=>{
					if(code==82){	//'R'key
						this.ResetForce();
					}
				},
			})
			//リトライボタン
			.AddToEventListenerList("retryButton",(sender,type)=>{
				if      (type===ccui.Widget.TOUCH_BEGAN){
					this.labels.navigation.SetTempText(L.Text("GamePlay.Navigator.Result.Retry"));
				}
				else if(type===ccui.Widget.TOUCH_ENDED){
					this.ReplaceScene(Scene.GamePlay);
				}
				else if (type===ccui.Widget.TOUCH_CANCELED){
					this.labels.navigation.RemoveTempText();
				}
				return true;
			})
			//シェアボタン
			.AddToEventListenerList("shareButton",(sender,type)=>{
				if      (type===ccui.Widget.TOUCH_BEGAN){
					this.labels.navigation.SetTempText(L.Text("GamePlay.Navigator.Result.Share"));
				}
				else if (type===ccui.Widget.TOUCH_ENDED){
					this.labels.navigation.RemoveTempText();
					cc.sys.openURL( L.Textf("GamePlay.Share.Format",[
										L.Textf("GamePlay.Share.Text",	[ L.NumToStr(this.GetDistanceInKm()),	L.Text("GamePlay.Distance.Unit"), ]),
										L.Text("GamePlay.Share.URL"),
										L.Text("GamePlay.Share.Tags")
									]));
				}
				else if (type===ccui.Widget.TOUCH_CANCELED){
					this.labels.navigation.RemoveTempText();
				}
				return true;
			});


		//共通イベント対応設定
		let commonEvents	= [];
		commonEvents.push(this.listeners.touched);
		Debug(()=>{
			//commonEvents.push(this.listeners.reset);
		});
		Scene.Sequence.SetCommonEventListeners(commonEvents);

		//シークエンス-イベント対応設定
		this.Sequences.START_AIM.SetEventListeners(		this.listeners.discharge		);
		this.Sequences.PRELIMINARY.SetEventListeners(	this.listeners.discharge		);
		this.Sequences.EMIT.SetEventListeners(			this.listeners.emitEnergy		);

		return this;
	}


	/** エミット倍率を取得
	 * @returns number
	 */
	GetEmittingRate(){
		let power	= 0;
		let add		= EmitEnergy.ADDITIONAL_POWER;
		//エミット値の加算
		for(let i=0; i<this.nEmits.total; ++i){
			power	+= add;
			add		= Math.max(1,--add);
		}
		//マルチタッチ補正
		const rateSimul	= this.nEmits.maxSimul + (this.nEmits.maxSimul-1)/2;

		return power / (rateSimul * EmitEnergy.ADDITIONAL_POWER *50) + 1;
	}

	/** チャージ倍率を取得
	 * @returns {number} 20-80
	 */
	GetChargingRate(){
		return this.chargedPower/BlowPower.INCREMENT + 20;
	}

	/**プレイヤー画像の表示*/
	UpdatePlayerSprite(){
		//座標修正
		let adjY	= this.sprites.player.GetCustomData("adjY",-100);	//修正
		let dy		= this.sprites.player.GetCustomData("dy",  3);		//増分
		if([this.Sequences.INITIAL,this.Sequences.START_AIM,this.Sequences.DISCHARGE_FAILED].includes(this.sequence)){
			dy += adjY < 0	? 0.005	: -0.005;
			if     (dy <-0.25) dy = MoveTo(dy,-0.25,0.05);
			else if(dy > 0.25) dy = MoveTo(dy, 0.25,0.05);
			adjY += dy;
		}

		//スプライト番号
		let idx	= this.sequence.count%128<16 ? 2 : 0;
		if([this.Sequences.PRELIMINARY].includes(this.sequence)){	//振りかぶり
			idx	= this.playerHardblows(this.chargingCount)	? 10	: 0;
		}
		else if([this.Sequences.DISCHARGE_FAILED].includes(this.sequence)){	//攻撃失敗
			idx	= 2;
		}
		else if([this.Sequences.DISCHARGE].includes(this.sequence)){	//攻撃中
			idx	= this.playerHardblows()	? 10	: 8;
		}
		else if([this.Sequences.EMIT,this.Sequences.BLOW_AWAY,this.Sequences.MEASURE].includes(this.sequence)){ //攻撃ヒット後	
			idx	= this.playerHardblows()	? 12	: 8;
		}
		if(Math.trunc(this.count/8) % 2) ++idx;

		this.sprites.player.SetIndex(idx).SetPosition(this.POSITIONS.PLAYER.X+Math.min(this.distanceOfMeteor,250)-this.chargingCount/512,this.POSITIONS.PLAYER.Y-this.chargingCount/1024+adjY).SetCustomData("adjY",adjY).SetCustomData("dy",dy);
		this.fx.player.Spawn(this.sprites.player.x,this.sprites.player.y-32,this.sequence!==this.Sequences.MEASURE).Update();
		return this;
	}

	GetDistanceInKm(){
		return Math.round( Math.min(this.distanceOfMeteor,this.totalPower)*1000000 );
	}

	/** プレイヤーが強打モーションを行うか
	 * @param {number?} [power=this.chargedPowerl]	検証するパワー値。省略時
	 * @returns {boolean}
	 */
	playerHardblows(power=this.chargedPower){
		return !(power < BlowPower.MAX/2);
	}

}//class


})();	//File Scope



