export type IconsId =
  | 'text-outline'
  | 'subject'
  | 'question-mark'
  | 'more-vertical'
  | 'message'
  | 'menu'
  | 'menu-arrow'
  | 'location-question'
  | 'link'
  | 'favorite'
  | 'favorite-outline'
  | 'eye'
  | 'eye-outline'
  | 'edit'
  | 'edit-outline'
  | 'close'
  | 'checkmark'
  | 'calendar'
  | 'at'
  | 'arrowhead-up'
  | 'arrowhead-down'
  | 'arrow-up-down'
  | 'add'
  | 'add-outline';

export type IconsKey =
  | 'TextOutline'
  | 'Subject'
  | 'QuestionMark'
  | 'MoreVertical'
  | 'Message'
  | 'Menu'
  | 'MenuArrow'
  | 'LocationQuestion'
  | 'Link'
  | 'Favorite'
  | 'FavoriteOutline'
  | 'Eye'
  | 'EyeOutline'
  | 'Edit'
  | 'EditOutline'
  | 'Close'
  | 'Checkmark'
  | 'Calendar'
  | 'At'
  | 'ArrowheadUp'
  | 'ArrowheadDown'
  | 'ArrowUpDown'
  | 'Add'
  | 'AddOutline';

export enum Icons {
  TextOutline = 'text-outline',
  Subject = 'subject',
  QuestionMark = 'question-mark',
  MoreVertical = 'more-vertical',
  Message = 'message',
  Menu = 'menu',
  MenuArrow = 'menu-arrow',
  LocationQuestion = 'location-question',
  Link = 'link',
  Favorite = 'favorite',
  FavoriteOutline = 'favorite-outline',
  Eye = 'eye',
  EyeOutline = 'eye-outline',
  Edit = 'edit',
  EditOutline = 'edit-outline',
  Close = 'close',
  Checkmark = 'checkmark',
  Calendar = 'calendar',
  At = 'at',
  ArrowheadUp = 'arrowhead-up',
  ArrowheadDown = 'arrowhead-down',
  ArrowUpDown = 'arrow-up-down',
  Add = 'add',
  AddOutline = 'add-outline',
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.TextOutline]: '61697',
  [Icons.Subject]: '61698',
  [Icons.QuestionMark]: '61699',
  [Icons.MoreVertical]: '61700',
  [Icons.Message]: '61701',
  [Icons.Menu]: '61702',
  [Icons.MenuArrow]: '61703',
  [Icons.LocationQuestion]: '61704',
  [Icons.Link]: '61705',
  [Icons.Favorite]: '61706',
  [Icons.FavoriteOutline]: '61707',
  [Icons.Eye]: '61708',
  [Icons.EyeOutline]: '61709',
  [Icons.Edit]: '61710',
  [Icons.EditOutline]: '61711',
  [Icons.Close]: '61712',
  [Icons.Checkmark]: '61713',
  [Icons.Calendar]: '61714',
  [Icons.At]: '61715',
  [Icons.ArrowheadUp]: '61716',
  [Icons.ArrowheadDown]: '61717',
  [Icons.ArrowUpDown]: '61718',
  [Icons.Add]: '61719',
  [Icons.AddOutline]: '61720',
};
