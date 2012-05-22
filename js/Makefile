FILES=common.js vtypes.js store.js grid.js form.js m2m.js GridToolbarCombo.js mk.RestfulEditorGridPanel.js mk.ProgressWindow.js mk.IFrameWindow.js App.js SearchField.js

extpiston.js: $(FILES)
	cat $(FILES) > extpiston.js

all: extpiston.js

clean:
	rm -f *.js~ *.css~ Makefile~ extpiston.js
