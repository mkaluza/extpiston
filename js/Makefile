FILES=common.js vtypes.js store.js grid.js form.js m2m.js GridToolbarCombo.js mk.RestfulEditorGridPanel.js mk.ProgressWindow.js mk.IFrameWindow.js App.js SearchField.js
SHELL=/bin/sh

extpiston.js: $(FILES)
	echo -n > extpiston.js
	for f in $(FILES); do \
		echo "/* FILE: $$f */" >> extpiston.js; \
		cat $$f >> extpiston.js; \
		echo >> extpiston.js; \
	done;

all: extpiston.js

clean:
	rm -f *.js~ *.css~ Makefile~ extpiston.js
