/* *******************************************************************************
	Recordsシーン
********************************************************************************/
var Scene	= Scene || {};
(function(){	//File Scope

/** リンクされたレイヤーのタグ */
const LinkedLayerTags	= {
	MAIN:	"Records.Main",
	BG:		"Records.Bg",
};

const PanelPosition		= {X:96,Y:240};
const RecordBoard	= {
	MaxRows:			5,
	MaxColumns:			2,
	Max:				5 * 2,	//MaxRows * MaxColumns
	Size:				{Width:160, Height:32},
};


Scene.Records	= class extends Scene.SceneBase {


	constructor(){
		super();

		this.Sequences	= {
			INITIAL:		null,	//初期状態
			RECORDS:		null,	//記録一覧
			ACHIEVEMENTS:	null,	//実績一覧
			TRANSITION:		null,	//トランジション用
		};
		this.mode	= Scene.Records.Mode.Records;

		this.sprites		= {};
		this.buttons		= {};
		this.displayBoards	= [];	//表示板

		/** ccSceneのインスタンス */
		this.ApplicateCcSceneInstance(this).InitLayerList();

		//シークエンス設定
		for(let i in this.Sequences){ this.Sequences[i] = Scene.Sequence.Create() }
		this.SetSequenceFunctions().InitEventListenerList();
	}


	/** ccLayerに渡す用 */
	InitLayerList(){
		const _this	= this;
		super.InitLayerList()
			.AddToLayerList("main",{
				ctor:function(){
					this._super();
					this.scheduleUpdate();

					//表示板
					_this.displayBoards	= _.range(RecordBoard.Max).map( h=>	{
						const body		= Label.CreateInstance( 9).AddToLayer(this).SetBgEnabled(true).SetAnchorPoint(0.0, 0.5);
						const counter	= Label.CreateInstance(11).AddToLayer(this).SetAnchorPoint(1.0, 0.5)
						body.bg.easeFunc	= ()=>cc.easeElasticOut(10);
						return {body:body,counter:counter};
					});

					return true;
				},
			})
			.AddToLayerList("bg",{
				ctor:function(){
					this._super();
					this.scheduleUpdate();
					_this.sprites.bg	= _.range(2).map(i=> Sprite.CreateInstance(rc.img.bgGround).AddToLayer(this).SetVisible(true) );
					return true;
				},
				update	: function(dt){
					this._super();
					const width		= cc.director.getWinSize().width;
					const bgWidth	= _this.sprites.bg[0].GetPieceSize().width;
					_this.sprites.bg.forEach((v,i)=>v.SetPosition(	width /2 - Cycle(_this.count, 0, bgWidth) + bgWidth*i,	256) );
				},
			})

		return this;
	}

	OnEnter(){
		super.OnEnter();
		this.SetLayer(LinkedLayerTags.BG,  this.ccLayers.bg,  0x0000)
			.SetLayer(LinkedLayerTags.MAIN,this.ccLayers.main,0x0001);	//各種処理があるのでmainレイヤは最後にセット

		this.InitSequences(this.Sequences,LinkedLayerTags.MAIN,this.ccLayerInstances[LinkedLayerTags.MAIN])
			.SetSequence(this.Sequences.INITIAL);

		if(this.pager)	this.pager.onPageChanged	= ()=>this.SetSequence(this.Sequences.TRANSITION);
		return this;
	}

	OnUpdating(dt){
		super.OnUpdating(dt);
		this.displayBoards.forEach( board=>board.body.Update(dt) );
		return this;
	}

	SetSequenceFunctions(){
		const size		= cc.director.getWinSize();

		//初期状態
		this.Sequences.INITIAL.PushStartingFunctions(()=>{
			//ラベル
			this.displayBoards
				.forEach(board=> board.body.Init().SetNumLogLines(2) );

		})
		.PushUpdatingFunctions(dt=>{
			 if(this.sequence.count>=60){
				if(this.mode===Scene.Records.Mode.Achievements)	this.SetSequence(this.Sequences.ACHIEVEMENTS);
				else if(this.mode===Scene.Records.Mode.Records)	this.SetSequence(this.Sequences.RECORDS);
			}
		});

		//スコア表示
		this.Sequences.RECORDS.PushStartingFunctions(()=>{

			let handles	= Store.GetVisibleHandles( this.pager ? this.pager.GetPage() : null);

			//ラベル
			this.displayBoards
				.forEach((board,i)=>{
					const handle	= handles.shift();
					if(!handle){
						board.body.SetVisible(false);
						board.counter.SetVisible(false);
						return;
					}

					//カウンタと公開フラグ
					//ヘッダテキスト＆カウンタ
					let count		= Store.Select(handle.Key,0);
					if(handle.Conv)	count = handle.Conv(count);
					if(String(Number(count))===count)	count = Number(count);

					const isPublic	= handle.Required!==null && handle.Required<=count || handle.Required===0;

					//カウンタと公開フラグ
					let text		= "";
					let fmtCount	= "";
					if(isPublic){
						count			= _.isString(count)	? count	: L.NumToStr(count, handle.nDecimalDigits);
						const patterns	= L.TextExists(handle.UnitKey)	? [count, L.Text(handle.UnitKey)]	: [count];
						fmtCount		= L.TextExists(`Records.${handle.Key}.Format`) ? L.Textf( `Records.${handle.Key}.Format`,patterns) : L.Textf("Unit.Counter",patterns);
						text			= L.Text(`Records.${handle.Key}`);
					}
					else{
						fmtCount		= L.Text("Records.Secret.Format");
						text			= L.TextExists(`Records.${handle.Key}.Secret`) ? L.Text(`Records.${handle.Key}.Secret`) : L.Text("Records.Secret");
					}

					const x	= Math.trunc(i/RecordBoard.MaxRows) * (RecordBoard.Size.Width+4);
					const y	= (i%RecordBoard.MaxRows) * (RecordBoard.Size.Height+4);
					board.body.bg.lower			= {width:RecordBoard.Size.Width, height:RecordBoard.Size.Height};
					board.body.bg.animationDelay= 0.05*i;
					board.body.bg.OPACITY		= isPublic	? 128 : 64;
					board.body.SetColor(	isPublic ? "#FFFF00" : "#AFAF00");
					board.counter.SetColor(	isPublic ? "#FFFFFF" : "#AFAFAF");;

					board.body
						.SetVisible(true)
						.SetPosition(PanelPosition.X+x,PanelPosition.Y-y)
						.SetString(` ${text}`);
					board.counter
						.SetVisible(false)
						.SetPosition(PanelPosition.X+x+RecordBoard.Size.Width-2,PanelPosition.Y-y-6)
						.SetString(`${fmtCount}`);
					board.body.bg.animationDelay	= 0.0;
				});
		})
		.PushUpdatingFunctions(dt=>{
			this.displayBoards.forEach((board,i)=>{
				if(board.body.IsVisible() && !board.body.bg.IsRunningActions())		board.counter.SetVisible(true);
			});
		});

		//実績一覧
		this.Sequences.ACHIEVEMENTS.PushStartingFunctions(()=>{
		})
		.PushUpdatingFunctions(dt=>{
		});

		//トランジション
		this.Sequences.TRANSITION.PushStartingFunctions(()=>{
			this.displayBoards.forEach(b=>{
				if(b.body.IsVisible())	b.body.RemoveString(false);
				if(b.counter.IsVisible())	b.counter.RemoveString(false);
			});
		})
		.PushUpdatingFunctions(dt=>{
			if( _(this.displayBoards).every(b=>!b.body.IsVisible() || !b.body.bg.IsRunningActions()) ){
				if(this.mode===Scene.Records.Mode.Achievements)	this.SetSequence(this.Sequences.ACHIEVEMENTS);
				else if(this.mode===Scene.Records.Mode.Records)	this.SetSequence(this.Sequences.RECORDS);
			}
		});

		return this;
	}

	InitEventListenerList(){
		super.InitEventListenerList();

		//共通イベント対応設定
		let commonEvents	= [];
		commonEvents.push(this.listeners.touched);
		commonEvents.push(this.listeners.keyboardReset);
		this.SetCommonEventListeners("SceneBase.TouchFx",commonEvents);

		return this;
	}

	/** 記録/実績のモード設定
	 * @param {*} [mode=Scene.Records.Mode.Records]
	 * @returns
	 */
	SetMode(mode=Scene.Records.Mode.Records){
		this.mode	= mode;
		if(this.mode===Scene.Records.Mode.Achievements)	this.EnableNaviButtons(Achievement.NumPages);
		else if(this.mode===Scene.Records.Mode.Records)	this.EnableNaviButtons(Store.NumPages);
		return this;
	}
	static get Mode(){
		return {
			Achievements:	1,
			Records:		2,
		};
	}

}//class

})();	//File Scope

