import {json} from '../_lib/session.js';
export function onRequest() { return json({error:'接口不存在或请求方法不支持。'},404); }
