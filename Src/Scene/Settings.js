/* *******************************************************************************
	Settingsシーン
********************************************************************************/
var cc,_;
var rc,L;
var Sprite,Store,Achievement,Locale,Selector,LockPanel;
var Cycle;
var Scene	= Scene || {};
(function(){	//File Scope

/** リンクされたレイヤーのタグ */
const LinkedLayerTags	= {
	MAIN:	"Settings.Main",
	BG:		"Settings.Bg",
};

/** 選択肢の個別設定 */
const OptionSettings	= {
	Locale:[
		{	Tag:"ja",					OnSelected:()=>{L.ApplyPreset("ja",false)},					},
		{	Tag:"en",					OnSelected:()=>{L.ApplyPreset("en",true)},					},
		{	Tag:"tw",					OnSelected:()=>{L.ApplyPreset("tw",true)},					},
		{	Tag:"ko",					OnSelected:()=>{L.ApplyPreset("ko",true)},					},
		{	Tag:Locale.UniversalCode,	OnSelected:()=>{L.ApplyPreset(Locale.UniversalCode,true)},	},
	],
	SfxVolume:[
		{	Tag:"0",					OnSelected:Store.Handles.Settings.SfxVolume,	},
		{	Tag:"1",					OnSelected:Store.Handles.Settings.SfxVolume,	},
		{	Tag:"2",					OnSelected:Store.Handles.Settings.SfxVolume,	},
		{	Tag:"3",					OnSelected:Store.Handles.Settings.SfxVolume,	},
		{	Tag:"4",					OnSelected:Store.Handles.Settings.SfxVolume,	},
		{	Tag:"5",					OnSelected:Store.Handles.Settings.SfxVolume,	},
	],
	BgmVolume:[
		{	Tag:"0",					OnSelected:Store.Handles.Settings.BgmVolume,	},
		{	Tag:"1",					OnSelected:Store.Handles.Settings.BgmVolume,	},
		{	Tag:"2",					OnSelected:Store.Handles.Settings.BgmVolume,	},
		{	Tag:"3",					OnSelected:Store.Handles.Settings.BgmVolume,	},
		{	Tag:"4",					OnSelected:Store.Handles.Settings.BgmVolume,	},
		{	Tag:"5",					OnSelected:Store.Handles.Settings.BgmVolume,	},
	],
	Meteorite:[
		{	Tag:"Normal",				OnSelected:Store.Handles.Settings.Meteorite,	},
		{	Tag:"Bear",					OnSelected:Store.Handles.Settings.Meteorite,	},
		{	Tag:"Triangle",				OnSelected:Store.Handles.Settings.Meteorite,	},
	],
	Navigator:[
		{	Tag:"Normal",				OnSelected:Store.Handles.Settings.Navigator,	},
		{	Tag:"Golem",				OnSelected:Store.Handles.Settings.Navigator,	},
		{	Tag:"Goddess",				OnSelected:Store.Handles.Settings.Navigator,	},
	],
	Transport:[
		{	Tag:"Import",				OnSelected:()=>Scene.Settings.Import(),	},
		{	Tag:"Export",				OnSelected:()=>Scene.Settings.Export(),	},
	],
	Storage:[
		{	Tag:"RemoveSettings",		OnSelected:()=> Scene.Settings.RemoveStorageData( "RemoveSettings",		true,false,false),	},
		{	Tag:"RemoveRecords",		OnSelected:()=> Scene.Settings.RemoveStorageData( "RemoveRecords",		false,true,false),	},
		{	Tag:"RemoveAchievements",	OnSelected:()=> Scene.Settings.RemoveStorageData( "RemoveAchievements",	false,false,true),	},
		{	Tag:"Remove",				OnSelected:()=> Scene.Settings.RemoveStorageData( "Remove",				true,true,true),	},
	],
};

/**セレクタ設定*/
const SelectorSettings	= {
	Locale:		{	Order:0,	KeepsOn:true,	IsEnabled:true,		},
	SfxVolume:	{	Order:0,	KeepsOn:true,	IsEnabled:true,		},
	BgmVolume:	{	Order:0,	KeepsOn:true,	IsEnabled:true,		},
	Meteorite:	{	Order:1,	KeepsOn:true,	IsEnabled:LockPanel.Enablers.Meteorite,	IdxStorage:0,	},
	Navigator:	{	Order:1,	KeepsOn:true,	IsEnabled:LockPanel.Enablers.Navigator,	IdxStorage:1,	},
	Transport:	{	Order:2,	KeepsOn:false,	IsEnabled:true,		},
	Storage:	{	Order:2,	KeepsOn:false,	IsEnabled:true,		},
};

/** @const セレクタ領域のマージン */
const SelectorAreaMargin	= {
	left:	16+64,
	top:	16,
};


Scene.Settings	= class extends Scene.SceneBase {

	constructor(){
		super();

		this.Sequences	= {
			INITIAL:	null,	//初期状態
			SELECTORS:	null,	//セレクタ
			TRANSITION:	null,
		};

		this.EnableNaviButtons(0);
		this.selectors	= {};
		_(OptionSettings).forEach((os,tag)=>this.selectors[tag]	= new Selector(os.length));
		_(this.selectors).forEach(s=>s.SetGap(0,32));
		this.sprites		= {};

		this.lockPanel	= null;

		this.EnableNaviButtons( _(SelectorSettings).reduce((result,ss)=>Math.max(result,ss.Order),0)+1 );
		if(this.pager)	this.pager.SetChapter(0, false);

		/** ccSceneのインスタンス */
		this.ApplyCcSceneInstance(this).InitLayerList();

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
					return true;
				},
			})
			.AddToLayerList("bg",{
				ctor:function(){
					this._super();
					this.scheduleUpdate();
					_this.sprites.bg	= _.range(2).map(()=> Sprite.CreateInstance(rc.img.bgGround).AddToLayer(this).SetVisible(true) );
					return true;
				},
				update	: function(/*dt*/){
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

		if(this.pager)	this.pager.onPageChanged	= ()=> this.SetSequence(this.Sequences.TRANSITION);

		this.InitUIs();
		return this;
	}

	OnUpdating(dt){
		super.OnUpdating(dt);
		_(this.selectors).forEach(s=>s.Update(dt));
		this.lockPanel.Update(dt);
		return this;
	}

	SetSequenceFunctions(){
		//初期状態
		this.Sequences.INITIAL.PushStartingFunctions(()=>{
		})
		.PushUpdatingFunctions((/*dt*/)=>{
			if(this.isEnterTransitionFinished)	this.SetSequence(this.Sequences.SELECTORS);
		});
		//セレクタ表示
		this.Sequences.SELECTORS.PushStartingFunctions(()=>{
			const page	= this.pager ? this.pager.GetPage() : 0;
			this.DeploySelectors(page);
		})
		.PushUpdatingFunctions((/*dt*/)=>{
		});
		//セレクタ消去
		this.Sequences.TRANSITION.PushStartingFunctions(()=>{
			_(this.selectors).forEach(s=>s.SetVisible(false))
		})
		.PushUpdatingFunctions((/*dt*/)=>{
			this.SetSequence(this.Sequences.SELECTORS);
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

	OnUiLayerCreate(layer){
		super.InitUIs(layer);
		_(this.selectors).forEach(s=>s.AddToLayer(layer));
		this.lockPanel	= LockPanel.CreateInstance(this.selectors);


		//初回起動時の初期設定
		if(Scene.SceneBase.isFirstBoot && !Scene.SceneBase.initialSettingIsCompleted){
			this.pageNavigator.buttons.at("Reset").OnButtonUp(()=>this.ReplaceScene(Scene.Logo));
			Scene.SceneBase.initialSettingIsCompleted	= true;
		}
		return true;
	}

	/** UIパーツ初期化 */
	InitUIs(){
		super.InitUIs();
		const size	= cc.director.getWinSize();

		let page=-1,i=0;
		_(this.selectors).forEach((selector,tag)=>{
			//セレクタは上から何番目に配置するか
			if(page != SelectorSettings[tag].Order){
				i	= 0;
				page= SelectorSettings[tag].Order;
			}

			selector
				.Init()
				.SetVisible(false)
				.SetCaptionByTextCode(`Settings.${tag}`)
				.Select( this.GetInitialSelectionIndexes(tag) )
				.KeepsOn(SelectorSettings[tag].KeepsOn)
				.Attr({zIndex:0x0100})
				.SetArea(	SelectorAreaMargin.left,	size.height - (SelectorAreaMargin.top+i*64)	)
				.SetEnabled(SelectorSettings[tag].IsEnabled, SelectorSettings[tag].IdxStorage)
				.SetOnSelected((idxButon,tagButton)=>{
					this.DispatchOnSelect(OptionSettings[tag],tagButton,0)
				})
				.buttons
					.SetTags( ... _(OptionSettings[tag]).map("Tag") )
					.forEach((b)=> b.SetLabelText(L.Text(`Settings.${tag}.Label.${b.tag}`)) );

			++i;
		});

		this.LoadUnlockFlags();
		return this;
	}

	DeploySelectors(page){
		this.lockPanel.Reset();
		_(this.selectors).forEach(s=>s.SetVisible(false));
		this.LoadUnlockFlags();

		_(SelectorSettings)
			.forEach((settings,key)=>{
				if(settings.Order!=page)	return this;

				const selector	= this.selectors[key];
				if(!selector)	return this;

				selector
					.SetVisible(true)
					.SetOpacity(255)

				//ロックパネル
				if(!selector.isEnabled){
					this.lockPanel.at(key).SetLocked(selector.state==Selector.States.Locked).Spawn();

					selector
						.SetOpacity(128)
						.buttons.forEach(b=>b.label.SetVisible(false));
				}
			});
	}

	//OnSelectedイベントの発行
	DispatchOnSelect(mappings,tag,idxDefault=null){
		//設定マッピング一覧を走査
		let mapping	= _(mappings).find(m=>tag==m.Tag);
		if(!mapping){
			if(idxDefault===null)	return this;
			else					mapping	= mappings[idxDefault];
		}

		if		(mapping.OnSelected===null)			return this;
		else if	(_.isFunction(mapping.OnSelected))	mapping.OnSelected();
		else										Store.Insert(mapping.OnSelected,mapping.Tag,null);
		return this;
	}

	get unlockFlags(){
		if(this._unlockFlags==null)	this._unlockFlags = Store.Select(Store.Handles.Settings.UnlockFlags,0);
		return this._unlockFlags;
	}

	LoadUnlockFlags(){
		_(this.selectors).forEach((selector)=>{
			selector._OnUnlocked	= ()=>this.DeploySelectors(this.pager.GetPage());
			if(!_.isNumber(selector.idxStorage) || selector.idxStorage<0)	return;
			if(this.unlockFlags & (1<<selector.idxStorage))	selector.Unlock(false);
		});
		return this;
	}


	/*選択肢の初期値*/
	GetInitialSelectionIndexes(tag){
		const currentSettings	= {
			Locale:		()=> L.GetCurrentPresetKey(),
			SfxVolume:	()=> Store.Select(Store.Handles.Settings.SfxVolume,"3"),
			BgmVolume:	()=> Store.Select(Store.Handles.Settings.BgmVolume,"3"),
			Navigator:	()=> Store.Select(Store.Handles.Settings.Navigator,"0"),
			Meteorite:	()=> Store.Select(Store.Handles.Settings.Meteorite,"0"),
			Transport:	()=> {},
			Storage:	()=> {},
		};
		const initialIndexes	= {
			Locale:		()=> Number(_(OptionSettings.Locale   ).findKey(m=> m.Tag==currentSettings.Locale())	||0),
			SfxVolume:	()=> Number(_(OptionSettings.SfxVolume).findKey(m=> m.Tag==currentSettings.SfxVolume())	||0),
			BgmVolume:	()=> Number(_(OptionSettings.BgmVolume).findKey(m=> m.Tag==currentSettings.BgmVolume())	||0),
			Navigator:	()=> Number(_(OptionSettings.Navigator).findKey(m=> m.Tag==currentSettings.Navigator())	||0),
			Meteorite:	()=> Number(_(OptionSettings.Meteorite).findKey(m=> m.Tag==currentSettings.Meteorite())	||0),
			Transport:	()=> null,
			Storage:	()=> null,
		};

		return initialIndexes[tag]();
	}

	/** ストレージデータの削除（確認ダイアログ付き）
	 * @param {string} tag					タグ
	 * @param {boolean} removesSettings		ゲーム設定を削除するか
	 * @param {boolean} removesRecords		プレイ記録を削除するか
	 * @param {boolean} removesAchievements	実績を削除するか
	 * @returns
	 */
	static RemoveStorageData(tag, removeSettings, removesRecords,removesAchievements){
		//確認ダイアログ
		if(!window.confirm(L.Text(`Settings.Storage.Confirm.${tag}`)))	return this;

		if(removeSettings)		Store.RemoveSettings();
		if(removesRecords)		Store.RemoveAll();
		if(removesAchievements)	Achievement.RemoveAll();
		window.location.reload();
		return this;
	}

	/** 記録と実績データのエクスポート
	 * @static
	 * @returns
	 */
	static Export(){
		const pairs	= _.merge( Store.SelectAll(), Achievement.SelectAll() );
		const enc	= Store._Encode( JSON.stringify(pairs), true);
		window.prompt(L.Text("Settings.Transport.Dialog.Export"),enc);
	}

	/** 記録と実績のインポート
	 * @static
	 * @returns
	 */
	static Import(){
		const input	= window.prompt(L.Text("Settings.Transport.Dialog.Import"));
		const json	= Store._Decode(input,null,true);
		if(!json)	return;

		//Remove
		Store.RemoveSettings();
		Store.RemoveAll();
		Achievement.RemoveAll();

		//Insert
		const pairs	= JSON.parse(json);
		_(pairs).forEach((value,key)=>{
			Store.Insert({Key:key},value,null)
		});
		return;
	}

}//class


})();	//File Scope



