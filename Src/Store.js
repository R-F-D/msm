/* *******************************************************************************
	ストレージ操作関数群
********************************************************************************/
var cc,_,CryptoJS;
var Achievement;
var isDebug;

class _Store{

	/** ストレージのレコードハンドル */
	static get Handles(){
		let container	= {
			GamePlay: {
				/** ハイスコア*/
				HighScore:					{Required:0,	Order:0x1000,	UnitKey:"Unit.Distance",	},
				/** 直近の平均飛距離 */
				MeanDistance:				{Required:0,	Order:0x1001,	UnitKey:"Unit.Distance",	Conv:Store.Convs.LinesToMean,	},
				/** チェックポイント到達回数 */
				NumPassings:[				{Required:0,	Order:0x1010,	},		//太陽
											{Required:1,	Order:0x1011,	},		//きらり
											{Required:1,	Order:0x1012,	},	],	//ユニコーン

				/** グッド回数 */
				NumGoods:					{Required:0,	Order:0x2000,	},
				/** パーフェクト回数 */
				NumPerfects:				{Required:0,	Order:0x2001,	},
				/** 100%パーフェクト回数 */
				NumTruePerfects:			{Required:0,	Order:0x2002,	},
				/** エイミング精度最高値 */
				BestAiming:					{Required:0,	Order:0x2003,	nDecimalDigits:1,	UnitKey:"Unit.Aim",	},
				/** 平均エイミング精度 */
				MeanAiming:					{Required:0,	Order:0x2004,	nDecimalDigits:1,	UnitKey:"Unit.Aim",		Conv:Store.Convs.LinesToMean,	},
				/** 強打回数 */
				NumHardBlowings:			{Required:0,	Order:0x2100,	},
				/** 強打＆パーフェクト回数 */
				NumHardAndPerfectBlowings:	{Required:0,	Order:0x2101,	},
				/** 全力打撃回数 */
				NumFullPowerBlowings:		{Required:0,	Order:0x2102,	},
				/** 最高打撃力 */
				BestBlowing:				{Required:0,	Order:0x2103,	nDecimalDigits:1,	UnitKey:"Unit.Blow",	},
				/** 平均打撃倍率 */
				MeanBlowing:				{Required:0,	Order:0x2104,	nDecimalDigits:1,	UnitKey:"Unit.Blow",	Conv:Store.Convs.LinesToMean,	},

				/** 最大エミット倍率 */
				MaxEmittings:				{Required:0,	Order:0x1110,	nDecimalDigits:1,	UnitKey:"Unit.Emit",	},
				/** 平均エミット倍率 */
				MeanEmitting:				{Required:0,	Order:0x1111,	nDecimalDigits:1,	UnitKey:"Unit.Emit",	Conv:Store.Convs.LinesToMean,	},
				/** 最高連続打撃成功数 */
				MaxSuccessiveHits:			{Required:0,	Order:0x1100,	},
				/** 連続打撃成功数 */
				NumSuccessiveHits:			{},
			},
			Action: {
				/** クリア回数 */
				NumPlays:					{Required:0,	Order:0x0000,	},
				/** リトライ回数 */
				NumRetrys:					{Required:0,	Order:0x0001,	},
				/** シェア回数 */
				NumShares:					{Required:0,	Order:0x0002,	},
				/** シェア回数（好成績） */
				NumSharesWithSuccessful:	{},
				/** 実績解除数*/
				TotalUnlockedAchievements:	{Required:0,	Order:0x0100,	nDecimalDigits:1,	Conv:()=>Store.Convs.GotAchievements(null,true)},
				NumUnlockedAchievements:[	{Required:0,	Order:0x0104,	Conv:()=>Store.Convs.GotAchievements(0)},
											{Required:0,	Order:0x0103,	Conv:()=>Store.Convs.GotAchievements(1)},
											{Required:0,	Order:0x0102,	Conv:()=>Store.Convs.GotAchievements(2)},
											{Required:0,	Order:0x0101,	Conv:()=>Store.Convs.GotAchievements(3)},		],
				/** 起動回数 */
				NumBootings:				{Required:0,	Order:0x0010,	},
				/** 起動日数 */
				NumBootingDays:				{},
				/** 連続起動日数（1日1カウントまで） */
				NumConsecutiveBootingDays:	{},
				/** 初めて起動した時刻 */
				FirstStartAt:				{},
				/** 最後に起動した時刻 */
				LastStartDay:				{},
				/** 実行時間 */
				RunTime:					{Required:0,	Order:0x0011,	Conv:Store.Convs.SecToTime,	},
				/** 合計実行時間 */
				TotalRunTime:				{Required:0,	Order:0x0012,	Conv:v=>Store.Convs.SecToTime(v,Store.Handles.Action.RunTime),	},
				/** ナビゲーション回数 */
				NumNavigates:[				{Required:0,	Order:0x3000,	},		//ノーマル
											{Required:1,	Order:0x3001,	},		//初めてのともだち
											{Required:1,	Order:0x3002,	},	],	//女神
				/** 隕石回数 */
				NumMeteoriteEngages:[		{Required:0,	Order:0x3010,	},		//ノーマル隕石
											{Required:1,	Order:0x3011,	},		//クマくん
											{Required:1,	Order:0x3012,	},	],	//さんかく
				/** タイトル画面でプレイヤーキャラをタッチした回数 */
				NumTouchesPlayer:			{Required:1,	Order:0x3100,	},

			},
			Settings:{
				/** 言語設定 */
				Language:					{},
				/** 数値の区切り設定 */
				NumberSeparation:			{},
				/** SFX音量 */
				SfxVolume:					{},
				/** BGM音量 */
				BgmVolume:					{},
				/** 隕石設定 */
				Meteorite:					{},
				/** ナビゲーター設定 */
				Navigator:					{},
				/** 設定項目のアンロック */
				UnlockFlags:				{},
				/**記録・実績の全公開設定*/
				RecordIsPublic:				{},
			},
		};

		//動的プロパティの生成
		_(container).forEach( (handles,category) =>	_(handles).forEach(
			(handle,key) =>	{
				_.castArray(handle)
					.forEach((h,i)=>{
						h.isVirtual	= false;
						h.Category	= category;
						h.Key 		= Array.isArray(handle)	? `${category}.${key}.${String(i).padStart(2,'0')}`
															: `${category}.${key}`;
						h.Page		= Math.trunc(h.Order/(16**3));
					});
			}
		));
		return container;
	}

	/**ハンドル識別子をストレージキー文字列に変換**/
	static _ToStorageKey(key){
		if(isDebug())	return Store._Prefix+key;
		else			return CryptoJS.MD5(Store._Prefix+key).toString();
	}

	static _SetItem(key,value){
		if(!isDebug())	value	= Store._Encode(value);
		cc.sys.localStorage.setItem(Store._ToStorageKey(key),value);
		return this;
	}
	static _GetItem(key,defaultValue=null){
		const result	= cc.sys.localStorage.getItem(Store._ToStorageKey(key)) || defaultValue;
		if(result==defaultValue || isDebug())	return result;
		else									return Store._Decode(result,defaultValue);
	}
	static _RemoveItem(key)	{ cc.sys.localStorage.removeItem(Store._ToStorageKey(key));	return this;}

	//値のエンコード（MD5＋Base64）
	static _Encode(str,force=false){
		if(str==null || (!force && isDebug()))	return str;
		str = `${Store._Prefix}${str}`;	//ソルト
		const hash	= CryptoJS.MD5(str).toString();
		const enc	= CryptoJS.enc.Base64.stringify( CryptoJS.enc.Utf8.parse(str) ).replace(/=+$/,"");	//Remove trail "="s
		return `${hash}${enc}`;
	}

	//値のデコード（MD5＋Base64）
	static _Decode(str,failed=null,force=false){
		if(str==null || (!force && isDebug()))	return str;
		try{
			const hash	= str.slice(0,32);
			const enc	= str.slice(32);
			if(hash.length!=32 && enc.length<=0)	throw new Error(`Failed to decrypt(slice): ${str}`);

			//デコードしてソルトを取り除く
			const decoded	= CryptoJS.enc.Base64.parse(enc).toString(CryptoJS.enc.Utf8);
			const result	= decoded.slice(Store._Prefix.length);

			//チェックサム
			const salt		= decoded.slice(0,Store._Prefix.length);
			const rehash	= CryptoJS.MD5(decoded).toString();
			if(salt!=Store._Prefix || hash!=rehash)	throw new Error(`Failed to decrypt(checkthumb): ${str}`);

			return result;
		}
		catch(e){
			console.log(e);
			return failed;
		}
	}


	/** ローカルストレージにインサート
	 * @param {Object} handle ストレージのハンドル
	 * @param {*} value 保存する値。ただしインサート成功時にコールバック関数が実行されたときはその返り値
	 * @param {function} [cond=null] インサート条件（保存時は真を返す）。
	 * @param {function} [resolve=null] インサート成功時コールバック
	 * @returns {*} 保存時は新値、未保存時は旧値
	 */
	static Insert(handle,value,cond=Store.Conds.NewValueIsGreater,resolve=null){
		const oldValue	= Store._GetItem(handle.Key);
		if(cond===null)	cond = Store.Conds.Always;

		if(cond(oldValue,value)){
			//インサート実行
			Store._SetItem(handle.Key,value);
			//成功時コールバック
			if(resolve)	{
				const result = resolve(handle.Key,value,oldValue);
				return result===undefined ? value : result;	//コールバック関数が実行された場合は戻り値を返す（undefinedを除く）
			}
			return value;
		}
		else{
			//インサートしない場合
			return oldValue;
		}
	}

	/** ローカルストレージにインサート（値は動的に生成）
	 * @param {string} handle ストレージのレコードハンドル
	 * @param {function} [valueGenerator=null] 現在値を受け取り新値を返す関数。
	 * @returns 新しい値
	 */
	static DynamicInsert(handle,valueGenerator=Store.Gens.Increment){
		//挿入値の生成
		const oldValue	= Store._GetItem(handle.Key);
		const value		= valueGenerator(oldValue);

		Store._SetItem(handle.Key,value);
		return value;
	}


	/** ログ取得・保存
	 * @static
	 * @param {*} handle ストレージのレコードハンドル
	 * @param {*} value 保存時は挿入する値。取得時はnull。
	 * @param {number} [nlogs=7] ログの保存件数
	 * @returns {array} ログの配列
	 * @memberof Store
	 */
	static Log(handle,value=null,nlogs=7){
		let result = [];
		Store.DynamicInsert(handle,currentString=>{
			let logs = currentString	?	currentString.split("\n",nlogs).map(v=>Number(v))	: [];
			if(value)	logs.push(value);
			result	= _(logs).takeRight(nlogs);
			return result.join("\n");
		});
		return result;
	}

	/** ローカルストレージからのロード
	 * @static
	 * @param {string} key				ストレージのハンドル
	 * @param {*} [defaultValue=null]	デフォルト値
	 * @returns
	 * @memberof Store
	 */
	static Select(handle,defaultValue=null){
		if(typeof handle==="string")	return Store._GetItem(handle,defaultValue);
		else							return Store._GetItem(handle.Key,defaultValue);
	}

	/** 表示可能なレコードのハンドル一覧を得る
	 * @readonly
	 * @static
	 * @memberof Store
	 */
	static GetVisibleHandles(page=null){
		const handles	= Store._GetHandleArray()
			.filter(h=>{
				//Requiredフラグ
				if(h.Required===undefined || h.Required===null)	return false;
				//Page一致
				if(page===undefined || page===null)	return true;
				else								return page === h.Page;
			});

		return _.orderBy(handles,"Order");
	}

	/**ハンドル一覧を配列で取得
	 * @static
	 * @returns
	 * @memberof Store
	 */
	static _GetHandleArray(){
		let results	= [];

		_(Store.Handles).forEach(category=>{	//カテゴリ舞のループ
			_(category).forEach(handles=>{	//ハンドルのループ
				_(handles)
					.castArray()		//配列化してからループ
					.forEach(h=>results.push(h));
			});
		});

		return results;
	}

	/** ページ数
	 * @readonly
	 * @static
	 * @memberof Store
	 */
	static get NumPages(){
		if(Store._nPages!==null)	return Store._nPages;

		return 1 + Store.GetVisibleHandles().reduce(
			(result,handle)=> Math.max(result,handle.Page),	0
		);
	}

	/** データ全削除（設定や実績を除く） */
	static RemoveAll(){
		Store._GetHandleArray()
			.filter(h=>h.Category != "Settings")
			.forEach(h=>Store._RemoveItem(h.Key));
	}
	/** 設定データ全削除 */
	static RemoveSettings(){
		Store._GetHandleArray()
			.filter(h=>h.Category == "Settings")
			.forEach(h=>Store._RemoveItem(h.Key));
	}

	static SelectAll(){
		let pairs	= {};
		Store._GetHandleArray()
			.filter(h=>h.Category != "Settings")
			.forEach(h=>{
				const value	= Store.Select(h);
				if(value!=null)	pairs[h.Key]	= value;
			});
		return pairs;
	}


	//----------------------------------------
	//	コールバック
	//----------------------------------------
	/** インサート条件関数
	 * @type {<string,function>}	f(currentValue,newValue):boolean
	 */
	static get Conds() {
		return{
			Always:					(/*currentValue,newValue*/)=>	true,
			/** 現在値が空欄のとき真 */
			CurrentValueIsEmpty:	(currentValue/*,newValue*/)=>	currentValue==null || currentValue=="",
			/** 現在値と挿入値を数値化し、後者が大きいとき真 */
			NewValueIsGreater:		(currentValue,newValue)=>		Number(currentValue||0) < Number(newValue),
		};
	}

	/** 挿入値の生成関数
	 * @type {<string,function>}	f(value):any
	 */
	static get Gens() {
		return{
			/** インクリメント */
			Increment:				value=>	(value==null||value=="") ? 1 : Number(value)+1,
			/** フラグのセット (value)=>f(number,number,boolean) */
			SetFlag:				(value,idxFlag,flag)=>{
				if(!_.isNumber(idxFlag) || idxFlag<0) return value;

				const mask	= 1 << Math.trunc(idxFlag);
				value		= Math.trunc(Math.abs(value));

				if(flag)	return value|mask;
				else		return value & ~mask;
			},
		};
	}

	/** Records表示の変換関数
	 * @type {<string,function>}	f(value):any
	 */
	static get Convs(){
		return {
			/**改行区切りの数値の平均*/
			LinesToMean: value=>{
				let ary	= String(value).split("\n",7);
				return ary ? ary.reduce((acc,cur)=>acc+Number(cur),0) / ary.length : 0;
			},
			/** 秒数を時間表記に*/
			SecToTime: (value,add=0)=>{
				const additionalSec	= _.isNumber(add)	? add	: Number(Store.Select(add));
				const totalSec		= Number(value) + additionalSec;
				const times			= [	totalSec/3600,	(totalSec/60)%60,	totalSec%60,].map(t=>String(Math.trunc(t)).padStart(2,"0"));
				return `${times[0]}:${times[1]}:${times[2]}`;
			},
			/** 実績解除数 */
			GotAchievements: (rank=null,isRatio=false)=>{
				if(isRatio)	return 100 * Achievement.GetNumUnlockedItems(rank) / Achievement.GetNumItems(rank);
				else		return `${Achievement.GetNumUnlockedItems(rank)} / ${Achievement.GetNumItems(rank)}`;
			},
		};
	}

} // class

_Store._nPages	= null;
_Store._Prefix	= "MSMomoko.";

var Store = _Store;


