import { Injectable, Output } from '@angular/core';
import * as io from 'socket.io-client';
import { UserService } from './user.service';
import { app } from '../../core/app';

@Injectable({
	providedIn: 'root',
})
export class SocketService {

    private _socket: any = {};

    get socket() {
		return this._socket;
	}

	constructor(
        private _userService: UserService
    ) {
        this.init();
    }
    
    public init() {
        this._socket = io(this._getSocketUrl(), {
			reconnectionAttempts: 10000, // avoid having user reconnect manually in order to prevent dead clients after a server restart
			timeout: 10000, // before connect_error and connect_timeout are emitted.
			// transports: ['websocket'],
			// query: 'userId=' + this._userService.model.options._id,
			secure: app.platform.isSecure,
			autoConnect: false
        });
    }

	public connect() {
        this._socket.open();
    }

    public disconnect() {
        this._socket.close();
    }

    private _getSocketUrl(): string {
        return app.address.host + '://' + app.address.ip + (app.address.port ? ':' + app.address.port : '');
        // return app.address.host + '://' + app.address.ip + (app.address.port ? ':' + app.address.port : '';
    }
}