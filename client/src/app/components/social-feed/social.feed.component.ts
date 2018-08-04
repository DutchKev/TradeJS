import {
	ChangeDetectionStrategy, Component, ElementRef, Host, Input, NgZone, OnInit, Output, Pipe, PipeTransform,
	ViewEncapsulation,
	OnDestroy,
	HostListener,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { UserService } from '../../services/user.service';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from "@angular/router";
import { CommentService } from "../../services/comment.service";
import { Subject, BehaviorSubject } from "rxjs";
import { CommentModel } from "../../models/comment.model";
import { ProfileComponent } from "../profile/profile.component";
import { UserModel } from '../../models/user.model';

const MAX_COMMENT_LENGTH = 200;
const SCROLL_LOAD_TRIGGER_OFFSET = 400;

function linkify(inputText) {
	var replacedText, replacePattern1, replacePattern2, replacePattern3;

	//URLs starting with http://, https://, or ftp://
	replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
	replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank" class="g-link">$1</a>');

	//URLs starting with "www." (without // before it, or it'd re-link the ones done above).
	replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
	replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank" class="g-link">$2</a>');

	//Change email addresses to mailto:: links.
	replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
	replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1" class="g-link">$1</a>');

	return replacedText;
}

function shortify(inputText: string) {
	if (inputText.length > 100) {
		const preText = inputText.substring(0, 100);
		inputText = preText + '<a>sdf</a><span style="display: none">' + inputText.substring(100) + '</span>';
	}

	return inputText;
}

@Pipe({ name: 'parseCommentContent' })
export class ParseCommentContentPipe implements PipeTransform {
	transform(value: string, field: string): string {
		value = linkify(value);

		if (value.length > MAX_COMMENT_LENGTH)
			return value.substring(0, MAX_COMMENT_LENGTH) + ' ...';

		return value;
	}
}


@Component({
	selector: 'app-social-feed',
	styleUrls: ['./social.feed.component.scss'],
	templateUrl: 'social.feed.component.html',
	// encapsulation: ViewEncapsulation.Native,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocialFeedComponent implements OnInit, AfterViewInit, OnDestroy {

	public comments$: BehaviorSubject<Array<CommentModel>> = new BehaviorSubject([]);
	public isLoading: boolean = true;
	@Input() feedType: string;

	userId: string;
	commentId: string;
	private _routeParamsSub;
	private _offset = 0;
	private _limit = 5;
	private _scrollActive = true;

	constructor(
		private _route: ActivatedRoute,
		public commentService: CommentService,
		public changeDetectorRef: ChangeDetectorRef,
		public _router: Router,
		public elementRef: ElementRef,
		public userService: UserService) {
	}

	ngOnInit() {
		this.commentId = this._route.snapshot.params['id'];
		this.userId = this._route.parent.snapshot.params['id']

		if (this.commentId)
			this._loadByPostId(this.commentId);
		else if (this.feedType === 'timeline') {
			this._loadTimeline();
		}
		else {
			this._loadByUserId(this.userId);

			this._routeParamsSub = this._route.parent.params.subscribe(params => {
				// only load if userId is different then current userId
				if (this.userId !== params['id']) {
					this._loadByUserId(params['id']);
				}
			});
		}
	}

	ngAfterViewInit() {
	}

	onEnterFunction() {

	}

	focusInput(event) {
		event.currentTarget.parentNode.parentNode.querySelector('input').focus();
	}

	addMessage(model) {
		const current = Array.from(this.comments$.getValue());

		if (model.options.parentId)
			current.find(c => c.options._id === model.options.parentId).options.children.push(model);
		else
			current.unshift(model);

		this.comments$.next(current);
	}

	public async toggleLike(model: CommentModel) {
		await this.commentService.toggleLike(model);
		this.changeDetectorRef.detectChanges();
	}

	async respond(event, parentModel: CommentModel) {
		const input = event.currentTarget;
		input.setAttribute('disabled', true);
		const comment = await this.commentService.create(parentModel.options.toUser, parentModel.options._id, input.value);
		input.removeAttribute('disabled');
		
		if (!comment)
			return;

		parentModel.options.childCount++;
		input.value = '';

		this.addMessage(comment);
	}

	onChangeFileInput(event) {

	}

	showMorePostActions(comment: CommentModel) {
		alert('more')
	}

	showMoreCommentActions(comment: CommentModel) {
		alert('more')
	}

	trackByFn(index, item) {
		return item.options._id; // or item.id
	}

	async loadMoreChildren(parentModel: CommentModel) {
		const children = <any>await this.commentService.findChildren(parentModel.options._id, parentModel.options.children.length);
		parentModel.options.children = children.concat(parentModel.options.children);
		this.changeDetectorRef.detectChanges();
	}

	public onClickShowMoreText(model: CommentModel, event) {
		event.target.previousElementSibling.innerHTML = linkify(model.options.content);
		event.target.parentNode.removeChild(event.target);
	}

	public onScroll(event) {
		if (!this._scrollActive || this.isLoading)
			return;

		if (event.target.scrollHeight - event.target.scrollTop - SCROLL_LOAD_TRIGGER_OFFSET >= event.target.clientHeight)
			return;

		if (this.commentId)
			this._loadByPostId(this.commentId);
		else if (this.feedType === 'timeline') {
			this._loadTimeline();
		}
		else {
			this._loadByUserId(this.userId);

			this._routeParamsSub = this._route.parent.params.subscribe(params => {
				// only load if userId is different then current userId
				if (this.userId !== params['id']) {
					this._loadByUserId(params['id']);
				}
			});
		}
	}

	private async _loadTimeline() {
		this.isLoading = true;
		const items = await this.commentService.findTimeline(this._offset);

		this.isLoading = false;

		if (items.length) {
			this._offset += items.length;
		} else {
			this._unbindScroll();
		}

		this.comments$.next(this.comments$.getValue().concat(items));
	}

	private async _loadByUserId(userId: string) {
		this.isLoading = true;
		const items = await this.commentService.findByUserId(userId, this._offset);
		this.isLoading = false;

		if (items.length) {
			this._offset += items.length;
		} else {
			this._unbindScroll();
		}

		this.comments$.next(this.comments$.getValue().concat(items));
	}

	private async _loadByPostId(postId: string) {
		this.isLoading = true;
		this.comments$.next([await this.commentService.findById(postId)]);
		this.isLoading = false;
	}

	private _unbindScroll() {
		this._scrollActive = false;
		// $(this.elementRef.nativeElement.parentNode).off('scroll.feed');
	}

	private _toggleScrollLoading(state: boolean) {

	}

	ngOnDestroy() {
		this._unbindScroll();

		if (this._routeParamsSub)
			this._routeParamsSub.unsubscribe();
	}
}