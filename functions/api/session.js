import {authenticated,json} from '../_lib/session.js';
export async function onRequestGet({request,env}) {
  return json({user:await authenticated(request,env)?{username:'admin',name:'比赛演示用户'}:null});
}
