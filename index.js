import osjs from 'osjs';
import {name as applicationName} from './metadata.json';
import {app, h} from 'hyperapp';
import {Box, BoxContainer, Toolbar, Button, Menubar, MenubarItem} from '@osjs/gui';
import {Book} from 'epubjs';

const register = (core, args, options, metadata) => {
  const _ = core.make('osjs/locale').translate;
  const vfs = core.make('osjs/vfs');
  const proc = core.make('osjs/application', {args, options, metadata});
  const {icon} = core.make('osjs/theme');
  const book = new Book();
  const container = document.createElement('div');

  let rendition;

  const win = proc.createWindow({
    id: 'EpubWindow',
    icon: proc.resource(metadata.icon),
    title: metadata.title.en_EN,
    dimension: {width: 400, height: 400}
  });

  const basic = core.make('osjs/basic-application', proc, win, {
    defaultFilename: null
  });

  const onload = actions => ab => {
    book.open(ab)
      .then(() => {
        rendition = book.renderTo(container, {
          minSpreadWidth: 100,
          resizeOnOrientationChange: false
        });

        rendition.on('started', () => win.emit('epubjs:resize'));

        rendition.on('relocated', location => {
          actions.setState({
            atStart: !!location.atStart,
            atEnd: !!location.atEnd
          });
        });

        rendition.display();
      })
      .catch(error => console.warn(error));
  };

  win.on('destroy', () => proc.destroy());

  win.on('epubjs:resize', () => {
    if (rendition && container) {
      const {offsetWidth, offsetHeight} = container.parentNode;
      const width = Math.max(offsetWidth, 1024);
      const height = Math.max(offsetHeight, 768);

      rendition.resize(width, height);
      rendition.moveTo({top: 0, left: 0});
    }
  });

  win.on('resized', () => win.emit('epubjs:resize'));
  win.on('render', () => win.emit('resized'));

  win.on('drop', (ev, data) => {
    if (data.isFile && data.mime) {
      const found = proc.metadata.mimes.find(m => (new RegExp(m)).test(data.mime));
      if (found) {
        basic.open(data);
      }
    }
  });

  proc.on('destroy', () => basic.destroy());

  win.render($content => {
    const ha = app({
      atStart: true,
      atEnd: true
    }, {
      setState: state => state,

      load: item => (state, actions) => {
        rendition = null;

        vfs.readfile(item, {}, 'arraybuffer')
          .then(onload(actions))
          .catch(error => console.error(error)); // FIXME: Dialog
      },

      menu: ev => (state, actions) => {
        core.make('osjs/contextmenu').show({
          position: ev.target,
          menu: [
            {label: _('LBL_OPEN'), onclick: () => actions.menuOpen()},
            {label: _('LBL_QUIT'), onclick: () => actions.menuQuit()}
          ]
        });
      },

      next: () => (rendition && rendition.next()),

      prev: () => (rendition && rendition.prev()),

      menuOpen: () => state => basic.createOpenDialog(),
      menuQuit: () => state => proc.destroy()
    }, (state, actions) => {
      return h(Box, {flex: 1, grow: 1}, [
        h(Menubar, {}, [
          h(MenubarItem, {
            onclick: ev => actions.menu(ev)
          }, _('LBL_FILE'))
        ]),
        h(Toolbar, {}, [
          h(Button, {
            icon: icon('go-previous'),
            title: 'Prev',
            onclick: () => actions.prev(),
            disabled: state.atStart
          }),
          h(Button, {
            icon: icon('go-next'),
            title: 'Next',
            onclick: () => actions.next(),
            disabled: state.atEnd
          })
        ]),
        h(BoxContainer, {
          grow: 1,
          shrink: 1,
          style: {overflow: 'auto'},
          class: 'osjs-gui-box-styled'
        }, h('div', {
          oncreate: el => el.appendChild(container),
          style: {
            width: '100%'
          }
        }))
      ]);
    }, $content);

    basic.on('open-file', ha.load);
    basic.init();
  });

  return proc;
};

osjs.register(applicationName, register);
