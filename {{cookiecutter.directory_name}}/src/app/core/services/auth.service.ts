import { Injectable } from '@angular/core';
import { CanLoad, Route, Router } from '@angular/router';
import { EnvservService } from './envserv.service';
import * as AWS from 'aws-sdk';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements CanLoad {
  AccessKeyId;
  SecretKey;
  SessionToken;
  aws_region;
  identityId;
  accessToken;
  expireTime;
  constructor(private env: EnvservService, private router: Router) { }
  async canLoad(route: Route): Promise<boolean> {
    /*     let access : any = await this.authenticate(); // enable this after you add okta details */
    let access: any = true;
    return access;
  }
  async authenticate() {
    if (localStorage.getItem('access_token') && localStorage.getItem('id_token') && new Date() <= new Date(Number(localStorage.getItem('id_token_expiry')))) {
      localStorage.setItem('curURL', window.location.href);
      if (!this.expireTime || new Date() > new Date(this.expireTime)) {
        let response = await this.validateWithCognito();
        return response;
      } else {
        return true;
      }
    } else {
      this.validateForTokenID();
      return false;
    }
  }
  async validateWithCognito() {
    const instance = this;
    let id_token = localStorage.getItem('id_token');
    var logins = {};
    logins[this.env.provider_url] = id_token;
    // Parameters required for CognitoIdentityCredentials
    var params = {
      IdentityPoolId: this.env.pool_id,
      Logins: logins
    };

    AWS.config.region = this.env.aws_region;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials(params);
    let result = await new Promise(function (resolve, reject) {
      (AWS.config.credentials as AWS.Credentials).get((err) => {
        if (err) {
          localStorage.removeItem('id_token');
          instance.validateForTokenID();
          resolve(false);
        } else {
          instance.expireTime = (AWS.config.credentials as AWS.Credentials).expireTime;
          instance.identityId = (AWS.config.credentials as AWS.CognitoIdentityCredentials).identityId;
          instance.AccessKeyId = (AWS.config.credentials as AWS.Credentials).accessKeyId;
          instance.SecretKey = (AWS.config.credentials as AWS.Credentials).secretAccessKey;
          instance.SessionToken = (AWS.config.credentials as AWS.Credentials).sessionToken;
          instance.accessToken = localStorage.getItem('access_token');
          instance.aws_region = instance.env.aws_region;
          debugger;
          resolve(true)
        }
      });
    });
    return result;
  }
  validateForTokenID() {
    let callbackUrl = window.location.href;
    let match = callbackUrl.match('id_token=([^&]*)');
    let error = callbackUrl.match('error=([^&]*)');
    let description = callbackUrl.match('error_description=([^&]*)');
    let accessToken = callbackUrl.match('access_token=([^&]*)');
    let id_token;
    let access_token;
    if (match) {
      id_token = match[1];
      access_token = accessToken[1];
    }
    if (id_token) {
      localStorage.setItem('id_token', id_token);
      localStorage.setItem('access_token', access_token);
      this.accessToken = access_token;
      let expiry = callbackUrl.match('expires_in=([^&]*)')
      let expiry_date = new Date().setSeconds(new Date().getSeconds() + Number(expiry[1]));
      localStorage.setItem('id_token_expiry', expiry_date.toString());
      if (localStorage.getItem('curURL'))
        window.location.replace(localStorage.getItem('curURL'));
      else
        this.router.navigate(['/home']);
    } else {
      if (error && error[1] === "access_denied") {
        this.router.navigate(['/denied']);
      } else {
        let url = this.env.adfsURL + '&client_id=' + this.env.client_id + '&redirect_uri=' + this.env.redirect_uri +
          '&nonce=' + this.makeid(16) + '&state=' + this.makeid(16);
        window.location.replace(url);
      }
    }
  }
  makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  clearLocalstorage() {
    localStorage.removeItem('curURL');
    localStorage.removeItem('id_token');
  }
}
