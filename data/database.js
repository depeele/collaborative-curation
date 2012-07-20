/** @file
 *
 *  The connection between our Backbone models and Database
 *
 */
(function() {
var root        = this,
    app         = root.app;

app.Database = {
    id:             'collaborativeCuration',
    description:    'A database to store topics, items, and data '
                    + 'associated with the collaborative collection '
                    + 'and curation of related data as well as the '
                    + 'final creation of reports based upon the '
                    + 'collected data.',
    migrations:     []
};

app.Database_init = function() {
    /* Combine all migrations in app.Database.migrations by version into a
     * single, app-controlled migration.
     *
     */
    var db          = app.Database,
        migrations  = {};
    db.migrations.forEach(function(migration) {
        var combined    = migrations[migration.version];

        if (! combined)
        {
            combined = migrations[migration.version] = [];
        }

        combined.push( migration.migrate );
    });

    db.migrations = [];
    for (var version in migrations)
    {
        // Force 'version' to be an integer
        version = (_.isNumber(version) ? version : parseInt(version));

        var combined    = migrations[version];
        db.migrations.push({
            version:    version,

            /** @brief  Combining migration for this version.
             *
             *  Note that a store is created and passed to the combined
             *  migration callbacks.
             */
            migrate:    function(transaction, next) {
                var idex    = 0,
                    cnt     = combined.length;
                function next_combined()
                {
                    if (idex < cnt)
                    {
                        var migrate = combined[idex];
                        idex++;
                        return migrate(transaction, next_combined);
                    }

                    // When all are completed, invoke next()
                    console.log("app.migrate(): version[ %s ], "
                                +   "all %d migrations complete",
                                version, combined.length);
                    next();
                }

                console.log("app.migrate(): version[ %s ], %d entries",
                            version, cnt);
                next_combined();
            }
        });
    }
};


}).call(this);
