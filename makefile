all: data/css/bootstrap.css

BOOTSTRAP_SRCS = less/bootstrap.less	\
		 less/code.less		\
		 less/forms.less	\
		 less/mixins.less	\
		 less/reset.less	\
		 less/tables.less	\
		 less/type.less		\
		 less/variables.less

data/css/bootstrap.css: $(BOOTSTRAP_SRCS)
	@/bin/echo -n "Compiling '$@'..."
	@lessc less/bootstrap.less > $@
	@/bin/echo " done"

clean:
	@rm -f data/css/bootstrap.css
