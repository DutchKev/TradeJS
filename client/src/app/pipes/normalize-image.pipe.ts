import { Pipe, PipeTransform } from "@angular/core";
import { app } from "../../core/app";
import { environment } from '../../environments/environment';

@Pipe({ name: 'NormalizeImgUrl' })
export class NormalizeImgUrlPipe implements PipeTransform {

	transform(value: string, type: string = 'user'): string {
		if (!value) {
			if (type === 'user') {
				value = 'assets/image/default-profile.jpg';
			} else {
				return '';
			}
		}

		if (value.startsWith('http'))
			return value;

		if (!value.startsWith('/'))
			value = '/image/profile/' + value;

		return app.address.cdnUrl + value;
		// return value;
	}
}